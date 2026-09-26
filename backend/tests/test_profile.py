import pytest

from core import database, models
from core.config import QUESTIONS_PER_INTERVIEW
from services import github_service
from tests.conftest import DEVOPS_RESUME, upload_text_resume

ANSWER = (
    "I would reproduce the problem first, because guessing wastes time. For example, I measured latency "
    "before and after each change and chose the option with the better trade-off. The result was a faster deploy."
)

GITHUB_USER = {"login": "Octo-Dev", "name": "Octo Dev", "html_url": "https://github.com/Octo-Dev", "public_repos": 4, "followers": 9}
GITHUB_REPOS = [
    {"name": "rate-limiter", "language": "Go", "size": 300, "stargazers_count": 7, "topics": ["redis"], "description": "Token bucket limiter", "html_url": "https://github.com/Octo-Dev/rate-limiter", "fork": False},
    {"name": "infra", "language": "HCL", "size": 100, "stargazers_count": 1, "topics": ["kubernetes", "docker"], "description": "", "html_url": "https://github.com/Octo-Dev/infra", "fork": False},
    {"name": "api", "language": "Python", "size": 600, "stargazers_count": 12, "topics": [], "description": "FastAPI service with PostgreSQL", "html_url": "https://github.com/Octo-Dev/api", "fork": False},
    {"name": "forked-lib", "language": "Rust", "size": 5000, "stargazers_count": 99, "topics": [], "description": "", "html_url": "x", "fork": True},
]


@pytest.fixture
def fake_github(monkeypatch):
    """Replaces the GitHub API call; `behaviour` can be switched to simulate failures."""
    state = {"behaviour": "ok", "calls": 0}

    async def fake_fetch(username):
        state["calls"] += 1
        if state["behaviour"] == "not_found":
            raise github_service.GitHubError("not_found", f"There is no GitHub user named {username}.")
        if state["behaviour"] == "rate_limited":
            raise github_service.GitHubError("rate_limited", "GitHub is limiting requests right now.")
        return github_service.summarize(GITHUB_USER, GITHUB_REPOS)

    monkeypatch.setattr(github_service, "fetch_github_profile", fake_fetch)
    return state


def complete_interview(client, headers, role_id, **extra):
    started = client.post("/interviews", headers=headers, json={"role_id": role_id, **extra}).json()
    question = started["question"]
    for _ in range(QUESTIONS_PER_INTERVIEW):
        body = client.post(f"/interviews/{started['interview_id']}/answers", headers=headers,
                           json={"question_id": question["id"], "answer_text": ANSWER}).json()
        if body["status"] == "in_progress":
            question = body["next_question"]
    return started["interview_id"]


def test_summary_for_a_new_user(client, user_headers):
    summary = client.get("/profile/summary", headers=user_headers).json()
    assert summary["resume"] is None
    assert summary["target"] is None
    assert summary["sphere"]["nodes"] == []
    assert summary["stats"]["completed"] == 0
    assert summary["next_step"] is None
    assert any(i["title"] == "Take your first mock interview" for i in summary["insights"])


def test_summary_with_resume_and_interviews(client, user_headers, roles):
    backend = roles["Backend Engineer"]
    upload_text_resume(client, user_headers, DEVOPS_RESUME)
    complete_interview(client, user_headers, backend["id"], seniority="Senior")
    live = client.post("/interviews", headers=user_headers, json={"role_id": backend["id"]}).json()

    summary = client.get("/profile/summary", headers=user_headers).json()
    assert summary["resume"]["filename"] == "resume.txt"
    assert "Docker" in summary["resume"]["skills"]
    assert summary["target"]["role_name"] == "Backend Engineer"
    assert 0 < summary["readiness"]["score"] <= 100
    statuses = {n["name"]: n["status"] for n in summary["sphere"]["nodes"]}
    assert statuses["Python"] in ("strong", "developing")
    assert statuses["Go"] == "missing"
    assert any(n["status"] == "extra" for n in summary["sphere"]["nodes"])

    stats = summary["stats"]
    assert stats["completed"] == 1 and stats["in_progress"] == 1
    assert len(stats["trend"]) == 1 and stats["average"] == stats["latest"]
    assert set(summary["quality"]) >= {"relevance", "correctness", "completeness", "lowest"}
    assert summary["recent_interviews"][0]["id"] == live["interview_id"]
    assert len(summary["recent_interviews"][1]["questions"]) == QUESTIONS_PER_INTERVIEW
    assert summary["next_step"]["interview_id"] == live["interview_id"]
    assert summary["next_step"]["answered"] == 0
    assert summary["study_plan"], "study plan should come from recommendations and gaps"
    assert any(i["title"].startswith("Next focus") for i in summary["insights"])


def test_linkedin_link_validation(client, user_headers):
    bad = client.put("/profile/links", headers=user_headers, json={"linkedin": "https://example.com/me"})
    assert bad.status_code == 400
    ok = client.put("/profile/links", headers=user_headers, json={"linkedin": "https://www.linkedin.com/in/ada-lovelace/"})
    assert ok.status_code == 200
    assert ok.json()["links"]["linkedin"] == "ada-lovelace"
    assert ok.json()["links"]["linkedin_url"] == "https://www.linkedin.com/in/ada-lovelace"
    removed = client.put("/profile/links", headers=user_headers, json={"linkedin": ""})
    assert removed.json()["links"]["linkedin"] is None


def test_github_import_counts_as_skill_evidence(client, user_headers, roles, fake_github):
    backend = roles["Backend Engineer"]
    upload_text_resume(client, user_headers, DEVOPS_RESUME)
    client.post("/interviews", headers=user_headers, json={"role_id": backend["id"]})
    before = {n["name"]: n for n in client.get("/profile/summary", headers=user_headers).json()["sphere"]["nodes"]}
    assert before["Go"]["status"] == "missing"

    saved = client.put("/profile/links", headers=user_headers, json={"github": "github.com/octo-dev"})
    assert saved.status_code == 200
    body = saved.json()
    assert body["warning"] is None
    assert body["links"]["github"] == "Octo-Dev"          # canonical casing from GitHub
    assert body["github"]["public_repos"] == 4
    assert sum(l["pct"] for l in body["github"]["languages"]) == 100

    after = client.get("/profile/summary", headers=user_headers).json()
    nodes = {n["name"]: n for n in after["sphere"]["nodes"]}
    assert nodes["Go"]["status"] == "developing" and nodes["Go"]["github"] is True
    gap = client.get(f"/skill-gaps?role_id={backend['id']}", headers=user_headers).json()
    assert "Go" in gap["developing_skills"]

    # Saving the same username again does not re-import; removing it drops the evidence.
    client.put("/profile/links", headers=user_headers, json={"github": "Octo-Dev"})
    assert fake_github["calls"] == 1
    client.put("/profile/links", headers=user_headers, json={"github": None})
    gap = client.get(f"/skill-gaps?role_id={backend['id']}", headers=user_headers).json()
    assert "Go" in gap["missing_skills"]


def test_github_errors(client, user_headers, fake_github):
    assert client.post("/profile/github/sync", headers=user_headers).status_code == 400

    fake_github["behaviour"] = "not_found"
    missing = client.put("/profile/links", headers=user_headers, json={"github": "nobody-here"})
    assert missing.status_code == 400
    assert "no GitHub user" in missing.json()["detail"]

    assert client.put("/profile/links", headers=user_headers, json={"github": "not a username!"}).status_code == 400

    fake_github["behaviour"] = "rate_limited"
    limited = client.put("/profile/links", headers=user_headers, json={"github": "octo"})
    assert limited.status_code == 200
    assert limited.json()["links"]["github"] == "octo"
    assert "import did not finish" in limited.json()["warning"]
    assert client.post("/profile/github/sync", headers=user_headers).status_code == 429

    fake_github["behaviour"] = "ok"
    synced = client.post("/profile/github/sync", headers=user_headers)
    assert synced.status_code == 200
    assert synced.json()["github"]["username"] == "Octo-Dev"


def test_github_summary_and_username_parsing():
    data = github_service.summarize(GITHUB_USER, GITHUB_REPOS)
    names = {s["name"] for s in data["skills"]}
    assert {"Go", "Python", "Terraform", "Kubernetes", "Docker", "Redis", "FastAPI", "PostgreSQL"} <= names
    assert "Rust" not in names                              # forks are ignored
    assert data["stars"] == 20
    assert data["top_repos"][0]["name"] == "api"
    assert github_service.parse_username("https://github.com/octo-dev/") == "octo-dev"
    assert github_service.parse_username("@octo") == "octo"
    assert github_service.parse_username("octo--dev") is None
    assert github_service.parse_username("https://gitlab.com/octo") is None


def test_update_display_name(client, user_headers):
    assert client.patch("/users/me", headers=user_headers, json={"name": "  "}).status_code == 422
    updated = client.patch("/users/me", headers=user_headers, json={"name": "Grace Hopper"})
    assert updated.status_code == 200 and updated.json()["name"] == "Grace Hopper"


def test_resume_interview(client, user_headers, roles):
    role_id = roles["Backend Engineer"]["id"]
    started = client.post("/interviews", headers=user_headers, json={"role_id": role_id, "seniority": "Junior"}).json()
    iid = started["interview_id"]
    client.post(f"/interviews/{iid}/answers", headers=user_headers, json={"question_id": started["question"]["id"], "answer_text": ANSWER})

    state = client.post(f"/interviews/{iid}/resume", headers=user_headers).json()
    assert state["questions_answered"] == 1
    assert state["seniority"] == "Junior"
    assert state["current_question"]["id"] != started["question"]["id"]
    assert state["last_evaluation"]["score"] is not None

    history = client.get("/interviews/history", headers=user_headers).json()
    assert history[0]["questions_answered"] == 1 and history[0]["role_id"] == role_id


def test_resume_repairs_an_interrupted_interview(client, user_headers, roles):
    role_id = roles["Backend Engineer"]["id"]
    started = client.post("/interviews", headers=user_headers, json={"role_id": role_id}).json()
    iid = started["interview_id"]
    client.post(f"/interviews/{iid}/answers", headers=user_headers, json={"question_id": started["question"]["id"], "answer_text": ANSWER})
    # Simulate the old behaviour: the answer was saved but the next question never was.
    db = database.SessionLocal()
    try:
        latest = db.query(models.Question).filter(models.Question.interview_id == iid).order_by(models.Question.id.desc()).first()
        db.delete(latest)
        db.commit()
    finally:
        db.close()

    state = client.post(f"/interviews/{iid}/resume", headers=user_headers).json()
    assert state["current_question"] is not None
    assert state["questions_answered"] == 1


def test_resume_rejects_completed_interviews(client, user_headers, roles):
    iid = complete_interview(client, user_headers, roles["Backend Engineer"]["id"])
    assert client.post(f"/interviews/{iid}/resume", headers=user_headers).status_code == 409
