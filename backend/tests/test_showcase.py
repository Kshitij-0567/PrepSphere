"""Benchmarks and the resume showcase. Every test here uses the SDE role, which no other test file touches."""
import pytest

from core import database, models
from core.countries import guess_country, guess_resume_country
from services.benchmarks import MIN_COHORT, measurable_results
from services.showcase import Redactor
from tests.conftest import upload_text_resume
from tests.test_profile import complete_interview

ROLE = "Software Development Engineer (SDE)"

# What the AI parser would return for STRONG_RESUME (tests run without Gemini).
STRONG_PROFILE = {
    "experience": [{
        "company": "Zentra Labs", "role": "Backend Intern", "duration": "Jun 2024 - Aug 2024",
        "responsibilities": [
            "Built a payments API at Zentra Labs that cut p95 latency by 40% for 10k users",
            "Wrote the runbook; questions to meera.iyer@gmail.com",
        ],
        "technologies": ["Python", "PostgreSQL"],
    }],
    "education": [{"degree": "B.Tech", "field": "Computer Science", "institution": "Anna University", "graduation_year": "2025", "grade": "8.4 CGPA"}],
    "projects": [{"name": "Ledger", "description": "Ledger service by Meera Iyer, code at github.com/meera-iyer/ledger", "technologies": ["Python", "Docker"], "domain": "Fintech"}],
    "certifications": [],
}

STRONG_RESUME = """Meera Iyer
meera.iyer@gmail.com | +91 91234 56789 | github.com/meera-iyer | meeraiyer.dev
Location: Chennai, India
Skills: Python, Git, PostgreSQL, Docker, Data Structures, Algorithms, Distributed Systems, Kafka
Experience: Backend Intern at Zentra Labs. Built a payments API that cut p95 latency by 40% for 10k users.
Project: Ledger service in Python with PostgreSQL and Docker, deployed with Kafka consumers.
"""

WEAK_RESUME = """Rohan Das
rohan@example.com
Skills: Python, Excel
Project: Built a Python script that cleans spreadsheets.
"""

MY_RESUME = """Kabir Singh
kabir.singh@example.com | +91 99887 76655
Skills: Python, Git
Project: Built a Python CLI for notes, tracked with Git.
"""


@pytest.fixture(scope="module")
def sde(roles):
    return roles[ROLE]


def _set_profile(email, fields):
    db = database.SessionLocal()
    try:
        resume = (
            db.query(models.Resume).join(models.User)
            .filter(models.User.email == email, models.Resume.is_active.is_(True)).one()
        )
        resume.parsed_profile_json = {**(resume.parsed_profile_json or {}), **fields}
        db.commit()
    finally:
        db.close()


def _candidate(client, signup, sde, resume, country=None, interviews=0, name="Candidate"):
    email, headers = signup(name)
    assert upload_text_resume(client, headers, resume).status_code == 200
    if resume == STRONG_RESUME:
        _set_profile(email, STRONG_PROFILE)
    if country:
        assert client.patch("/users/me", headers=headers, json={"country": country}).status_code == 200
    for _ in range(interviews):
        complete_interview(client, headers, sde["id"])
    if not interviews:
        client.post("/interviews", headers=headers, json={"role_id": sde["id"]})
    return headers


# --- helpers ---

def test_redactor_removes_contact_details_but_keeps_tech_names():
    user = models.User(name="Meera Iyer", email="meera.iyer@gmail.com", github_username="meera-iyer")
    personal = {"phone": "+91 91234 56789", "portfolio": "meeraiyer.dev"}
    text = Redactor(user, personal).text(
        "Meera built it with Node.js/Express and ASP.NET/Core. Mail meera.iyer@gmail.com or call +91 91234 56789, "
        "see github.com/meera-iyer/ledger, https://ledger.example.com, meeraiyer.dev and @meera_codes. Ran 2019 - 2023."
    )
    assert "Node.js/Express" in text and "ASP.NET/Core" in text
    for leaked in ("Meera", "gmail", "91234", "meera-iyer", "example.com", "meeraiyer", "@meera_codes"):
        assert leaked not in text
    assert "2019 - 2023" in text


def test_percentile_counts_ties_as_half():
    from services.benchmarks import _percentile
    assert _percentile(5, [5, 5, 5, 5]) == 50
    assert _percentile(9, [1, 2, 3, 9]) == 88
    assert _percentile(0, [1, 2]) == 0
    assert _percentile(None, [1]) is None and _percentile(3, []) is None


def test_measurable_results_and_country_guess():
    text = "Cut latency by 40%\nServed 10k users\nB.Tech 8.5 CGPA\nClass XII 92%\nBuilt a CLI"
    assert measurable_results(text) == 2
    assert guess_country("Pune, Maharashtra, India") == "IN"
    assert guess_country("New York, NY, USA") == "US"
    assert guess_country("Remote") is None
    assert guess_resume_country(None, "Jordan Smith\njordan@example.com\nSkills: Python, Git") is None
    assert guess_resume_country(None, "Asha Rao\nLocation: Pune\nSkills: Python") == "IN"
    assert guess_resume_country(None, "Asha Rao | Toronto, Canada") == "CA"


def test_country_is_saved_validated_and_cleared(client, user_headers):
    assert client.patch("/users/me", headers=user_headers, json={"country": "in"}).json()["country"] == "IN"
    assert client.patch("/users/me", headers=user_headers, json={"country": "XX"}).status_code == 400
    me = client.patch("/users/me", headers=user_headers, json={"country": ""}).json()
    assert me["country"] is None and me["name"] == "Test Candidate"
    assert any(c["code"] == "IN" and c["name"] == "India" for c in client.get("/countries").json())


# --- benchmarks ---

def test_benchmarks_hold_back_figures_until_enough_candidates(client, signup, sde):
    headers = _candidate(client, signup, sde, MY_RESUME)
    data = client.get("/benchmarks", headers=headers, params={"role_id": sde["id"], "country": "NZ"}).json()
    assert data["role"]["name"] == ROLE
    assert data["scope"] == {"code": "NZ", "name": "New Zealand"}
    assert data["enough"] is False and data["cohort_size"] < MIN_COHORT
    assert data["percentiles"] is None and data["top"] is None and data["skills_to_add"] == []
    assert data["you"]["readiness"] > 0
    assert data["suggested_country"] is None  # the resume has no location


def test_benchmarks_compare_with_the_cohort(client, signup, sde):
    for _ in range(4):
        _candidate(client, signup, sde, STRONG_RESUME, country="IN", interviews=1)
    for _ in range(2):
        _candidate(client, signup, sde, WEAK_RESUME, country="IN")
    me = _candidate(client, signup, sde, MY_RESUME, country="IN")

    data = client.get("/benchmarks", headers=me, params={"role_id": sde["id"]}).json()
    assert data["enough"] is True and data["cohort_size"] >= 6
    assert data["your_country"]["code"] == "IN"
    assert any(c["code"] == "IN" and c["candidates"] >= 6 for c in data["countries"])
    # Better than the two weak resumes, behind the strong ones.
    assert 0 < data["percentiles"]["score"] < 100
    assert data["percentiles"]["readiness"] > 0
    assert data["percentiles"]["interview"] is None  # this user has no completed interview
    assert data["top"]["size"] >= 3 and data["top"]["averages"]["readiness"] > data["you"]["readiness"]
    assert sum(data["distribution"]["buckets"]) == data["cohort_size"]

    suggested = {s["name"]: s for s in data["skills_to_add"]}
    assert "Docker" in suggested and suggested["Docker"]["required"] is False
    assert suggested["Data Structures"]["required"] is True
    assert "Python" not in suggested and "Git" not in suggested  # already on this resume

    india = client.get("/benchmarks", headers=me, params={"role_id": sde["id"], "country": "IN"}).json()
    assert india["scope"]["code"] == "IN" and india["enough"] is True
    assert client.get("/benchmarks", headers=me, params={"country": "ZZ"}).status_code == 400


def test_demo_accounts_are_left_out(client, user_headers, sde):
    before = client.get("/benchmarks", headers=user_headers, params={"role_id": sde["id"]}).json()["cohort_size"]
    demo = {"Authorization": f"Bearer {client.post('/auth/demo').json()['access_token']}"}
    upload_text_resume(client, demo, STRONG_RESUME)
    client.post("/interviews", headers=demo, json={"role_id": sde["id"]})
    after = client.get("/benchmarks", headers=user_headers, params={"role_id": sde["id"]}).json()["cohort_size"]
    assert after == before

    assert client.get("/showcase/me", headers=demo).json()["blocked_reason"] == "demo"
    assert client.put("/showcase", headers=demo, json={"role_id": sde["id"], "confirm": True}).status_code == 403


# --- showcase ---

def test_publish_requires_a_resume_and_confirmation(client, user_headers, sde):
    assert client.put("/showcase", headers=user_headers, json={"role_id": sde["id"], "confirm": True}).status_code == 400
    upload_text_resume(client, user_headers, STRONG_RESUME)
    response = client.put("/showcase", headers=user_headers, json={"role_id": sde["id"]})
    assert response.status_code == 400 and "confirm" in response.json()["detail"]
    me = client.get("/showcase/me", headers=user_headers).json()
    assert me["showcase"] is None and me["blocked_reason"] is None
    assert me["suggested_country"]["code"] == "IN"


def test_preview_and_published_copy_hide_personal_details(client, signup, sde):
    headers = _candidate(client, signup, sde, STRONG_RESUME, country="IN", interviews=1, name="Meera Iyer")
    preview = client.post("/showcase/preview", headers=headers, json={"role_id": sde["id"], "seniority": "Junior"}).json()
    published = client.put("/showcase", headers=headers, json={"role_id": sde["id"], "seniority": "Junior", "confirm": True}).json()

    for body in (preview, published):
        text = str(body)
        for leaked in ("Meera", "Iyer", "gmail", "91234", "meera-iyer", "meeraiyer", "Zentra", "Anna University"):
            assert leaked not in text, leaked
        assert body["experience_items"][0]["company"] is None
        assert "[company]" in body["experience_items"][0]["points"][0]
        assert body["education_items"][0]["institution"] is None
        assert body["anonymous"] is True and body["name"] == preview["name"]
        assert body["country"]["code"] == "IN" and body["seniority"] == "Junior"
        assert "Docker" in body["skills"] and body["project_items"]
        assert body["interview"] is not None and body["score"] > 0
    assert published["rank"] >= 1 and published["is_you"] is True

    me = client.get("/showcase/me", headers=headers).json()
    assert me["showcase"]["public_id"] == published["public_id"]
    assert me["handle"] == published["name"] and me["outdated"] is False


def test_leaderboard_detail_compare_and_filters(client, signup, sde):
    owner = _candidate(client, signup, sde, STRONG_RESUME, country="IN", interviews=1)
    entry = client.put("/showcase", headers=owner, json={"role_id": sde["id"], "show_companies": True, "confirm": True}).json()
    viewer = _candidate(client, signup, sde, MY_RESUME, country="US")

    board = client.get("/showcase", headers=viewer, params={"role_id": sde["id"]}).json()
    ranks = [e["rank"] for e in board["entries"]]
    assert ranks == list(range(1, len(ranks) + 1))
    scores = [e["score"] for e in board["entries"]]
    assert scores == sorted(scores, reverse=True)
    mine = next(e for e in board["entries"] if e["public_id"] == entry["public_id"])
    assert mine["is_you"] is False and board["you"] is None
    assert board["role_counts"][str(sde["id"])] >= 1
    assert any(c["code"] == "IN" for c in board["countries"])

    assert all(e["country"]["code"] == "IN" for e in client.get("/showcase", headers=viewer, params={"role_id": sde["id"], "country": "IN"}).json()["entries"])
    assert client.get("/showcase", headers=viewer, params={"role_id": sde["id"], "country": "US"}).json()["total"] == 0
    assert client.get("/showcase", headers=viewer, params={"role_id": sde["id"], "seniority": "Senior"}).json()["total"] == 0

    detail = client.get(f"/showcase/{entry['public_id']}", headers=viewer).json()
    assert detail["experience_items"][0]["company"] == "Zentra Labs"  # the owner chose to show companies
    assert detail["education_items"][0]["institution"] is None

    comparison = client.get(f"/showcase/{entry['public_id']}/compare", headers=viewer).json()
    assert comparison["has_resume"] is True
    assert "Python" in comparison["skills"]["both"]
    assert "Docker" in comparison["skills"]["only_them"]
    assert comparison["them"]["readiness"] > comparison["you"]["readiness"]
    rows = {r["name"]: r for r in comparison["requirements"]}
    assert rows["Python"]["you"] and rows["Python"]["them"]
    assert rows["PostgreSQL"]["them"] and not rows["PostgreSQL"]["you"]


def test_reports_hide_a_resume_until_its_owner_changes_it(client, signup, sde):
    owner = _candidate(client, signup, sde, STRONG_RESUME)
    public_id = client.put("/showcase", headers=owner, json={"role_id": sde["id"], "confirm": True}).json()["public_id"]
    assert client.post(f"/showcase/{public_id}/report", headers=owner, json={"reason": "fake"}).status_code == 400

    reporters = [signup()[1] for _ in range(3)]
    first = client.post(f"/showcase/{public_id}/report", headers=reporters[0], json={"reason": "personal_details"}).json()
    again = client.post(f"/showcase/{public_id}/report", headers=reporters[0], json={"reason": "fake"}).json()
    assert first["already_reported"] is False and again["already_reported"] is True
    for headers in reporters[1:]:
        client.post(f"/showcase/{public_id}/report", headers=headers, json={"reason": "offensive"})

    assert client.get(f"/showcase/{public_id}", headers=reporters[0]).status_code == 404
    own = client.get("/showcase/me", headers=owner).json()["showcase"]
    assert own["hidden"] is True

    # Republishing the same copy keeps it hidden; a changed copy is visible again.
    assert client.put("/showcase", headers=owner, json={"role_id": sde["id"], "confirm": True}).json()["hidden"] is True
    changed = client.put("/showcase", headers=owner, json={"role_id": sde["id"], "show_companies": True, "confirm": True}).json()
    assert changed["hidden"] is False
    assert client.get(f"/showcase/{public_id}", headers=reporters[0]).status_code == 200


def test_unpublish_and_resume_deletion_remove_the_copy(client, signup, sde):
    owner = _candidate(client, signup, sde, STRONG_RESUME)
    public_id = client.put("/showcase", headers=owner, json={"role_id": sde["id"], "confirm": True}).json()["public_id"]
    assert client.delete("/showcase", headers=owner).json() == {"removed": True}
    assert client.get(f"/showcase/{public_id}", headers=owner).status_code == 404
    assert client.delete("/showcase", headers=owner).status_code == 404

    public_id = client.put("/showcase", headers=owner, json={"role_id": sde["id"], "confirm": True}).json()["public_id"]
    resume_id = client.get("/showcase/me", headers=owner).json()["active_resume"]["id"]
    upload_text_resume(client, owner, WEAK_RESUME)
    assert client.get("/showcase/me", headers=owner).json()["outdated"] is True
    deleted = client.delete(f"/resumes/{resume_id}", headers=owner).json()
    assert deleted["showcase_removed"] is True
    assert client.get(f"/showcase/{public_id}", headers=owner).status_code == 404
