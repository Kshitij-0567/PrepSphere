import pytest

from core.config import QUESTIONS_PER_INTERVIEW
from tests.conftest import DEVOPS_RESUME, upload_text_resume

GOOD_ANSWER = (
    "I would start by reproducing the issue, because guessing wastes time. For example, in my last "
    "project I measured latency before and after each change, compared two approaches and chose the "
    "one with the better trade-off between cost and reliability. The result was a 30% faster deploy."
)


def start_interview(client, headers, roles, **extra):
    payload = {"role_id": roles["DevOps & Platform Engineer"]["id"], **extra}
    response = client.post("/interviews", headers=headers, json=payload)
    assert response.status_code == 200, response.text
    return response.json()


def answer_all(client, headers, interview):
    question = interview["question"]
    body = None
    for _ in range(QUESTIONS_PER_INTERVIEW):
        response = client.post(
            f"/interviews/{interview['interview_id']}/answers",
            headers=headers,
            json={"question_id": question["id"], "answer_text": GOOD_ANSWER},
        )
        assert response.status_code == 200, response.text
        body = response.json()
        if body["status"] == "in_progress":
            question = body["next_question"]
    return body, question


def test_full_interview_flow(client, user_headers, roles):
    upload_text_resume(client, user_headers, DEVOPS_RESUME)
    jd = "Senior DevOps Engineer. Must have 5+ years experience with Kubernetes and Prometheus."
    interview = start_interview(client, user_headers, roles, seniority="Senior", job_description=jd)

    assert "Prometheus" in interview["jd_skills"]
    assert "expected_concepts" not in interview["question"]   # hidden while answering
    assert interview["question"]["difficulty"] == "Hard"      # senior, no company

    final, last_question = answer_all(client, user_headers, interview)
    assert final["status"] == "completed"
    assert final["questions_answered"] == QUESTIONS_PER_INTERVIEW
    assert 0 <= final["overall_score"] <= 10
    assert final["evaluation"]["evaluator"] == "fallback"

    # Completed interviews accept no more answers.
    again = client.post(
        f"/interviews/{interview['interview_id']}/answers",
        headers=user_headers,
        json={"question_id": last_question["id"], "answer_text": GOOD_ANSWER},
    )
    assert again.status_code == 409

    results = client.get(f"/interviews/{interview['interview_id']}/results", headers=user_headers).json()
    assert results["status"] == "completed"
    assert results["seniority"] == "Senior"
    assert results["completed_at"] is not None
    assert results["used_fallback_evaluator"] is True
    assert len(results["evaluations"]) == QUESTIONS_PER_INTERVIEW
    assert all(e["expected_concepts"] for e in results["evaluations"])   # revealed after answering
    assert results["recommendations"], "recommendations should be linked to this interview"
    assert all(r["interview_id"] == interview["interview_id"] for r in results["recommendations"])

    history = client.get("/interviews/history", headers=user_headers).json()
    assert history[0]["id"] == interview["interview_id"] and history[0]["status"] == "completed"


def test_fallback_questions_rotate_topics(client, user_headers, roles):
    upload_text_resume(client, user_headers, DEVOPS_RESUME)
    interview = start_interview(client, user_headers, roles)
    texts = {interview["question"]["question_text"]}
    question = interview["question"]
    for _ in range(QUESTIONS_PER_INTERVIEW - 1):
        body = client.post(
            f"/interviews/{interview['interview_id']}/answers",
            headers=user_headers,
            json={"question_id": question["id"], "answer_text": GOOD_ANSWER},
        ).json()
        question = body["next_question"]
        texts.add(question["question_text"])
    assert len(texts) == QUESTIONS_PER_INTERVIEW


def test_answer_validation(client, signup, roles):
    _, headers = signup()
    interview = start_interview(client, headers, roles)
    iid = interview["interview_id"]
    qid = interview["question"]["id"]

    assert client.post(f"/interviews/{iid}/answers", headers=headers, json={"question_id": qid, "answer_text": "   "}).status_code == 422

    other = start_interview(client, headers, roles)
    wrong = client.post(f"/interviews/{iid}/answers", headers=headers, json={"question_id": other["question"]["id"], "answer_text": GOOD_ANSWER})
    assert wrong.status_code == 404

    first = client.post(f"/interviews/{iid}/answers", headers=headers, json={"question_id": qid, "answer_text": GOOD_ANSWER})
    assert first.status_code == 200
    duplicate = client.post(f"/interviews/{iid}/answers", headers=headers, json={"question_id": qid, "answer_text": GOOD_ANSWER})
    assert duplicate.status_code == 409


def test_interviews_are_private(client, signup, roles):
    _, owner = signup()
    _, other = signup()
    interview = start_interview(client, owner, roles)
    iid = interview["interview_id"]
    assert client.get(f"/interviews/{iid}/results", headers=other).status_code == 404
    assert client.get(f"/interviews/{iid}/current-question", headers=other).status_code == 404
    response = client.post(f"/interviews/{iid}/answers", headers=other, json={"question_id": interview["question"]["id"], "answer_text": GOOD_ANSWER})
    assert response.status_code == 404


def test_unknown_role_or_company_is_rejected(client, user_headers, roles):
    role_id = roles["DevOps & Platform Engineer"]["id"]
    assert client.post("/interviews", headers=user_headers, json={"role_id": 999999}).status_code == 404
    assert client.post("/interviews", headers=user_headers, json={"role_id": role_id, "company_id": 999999}).status_code == 404
    assert client.post("/interviews", headers=user_headers, json={"role_id": role_id, "seniority": "Intern"}).status_code == 422


@pytest.mark.parametrize("seniority, expected", [("Junior", "Medium"), ("Mid", "Hard"), ("Senior", "Hard")])
def test_company_rigor_adjusts_difficulty(client, user_headers, roles, seniority, expected):
    google = next(c for c in client.get("/companies?search=Google").json() if c["name"] == "Google")
    assert google["difficulty_level"] == "Hard"
    interview = start_interview(client, user_headers, roles, seniority=seniority, company_id=google["id"])
    assert interview["question"]["difficulty"] == expected
    assert "Google" in interview["question"]["question_text"]
