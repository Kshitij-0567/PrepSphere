import base64
import json

import pytest

from core.config import settings
from services import delivery, video_interview
from services.gemini_service import gemini_service
from services.interview_plan import MAX_FOLLOW_UPS, build_plan
from tests.conftest import DEVOPS_RESUME, upload_text_resume

PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")
SPOKEN = (
    "In my last role I owned the deploy pipeline, because releases kept failing. For example, I measured "
    "each stage, compared two approaches and chose the one with the better trade-off. The result was a "
    "30% faster deploy, um, and far fewer rollbacks."
)
CODE = "def allow(client_id, now):\n    q = hits[client_id]\n    while q and q[0] <= now - 60:\n        q.popleft()\n    return len(q) < LIMIT\n"
DELIVERY = json.dumps({"duration": 42, "speaking": 36, "pauses": [[10, 4.2], [20, 1.5]], "eye_contact": 0.7, "face_in_frame": 0.95})


def _role(roles, category):
    return next(r for r in roles.values() if r["category"] == category)


def _start(client, headers, role, seniority="Mid"):
    response = client.post("/interviews", headers=headers, json={"role_id": role["id"], "seniority": seniority, "mode": "video"})
    assert response.status_code == 200, response.text
    return response.json()


def _answer(client, headers, interview_id, question, **overrides):
    data = {"question_id": str(question["id"]), "delivery": DELIVERY}
    files = {}
    if question["kind"] == "spoken":
        data.update({"text": SPOKEN, "text_source": "captions"})
    elif question["kind"] == "code":
        data.update({"code": CODE, "language": question["details"]["languages"][0], "text": "I keep a queue per client."})
    else:
        data["text"] = "A queue feeds dispatcher workers; failures go to a retry scheduler and a dead-letter queue."
        files["diagram"] = ("diagram.png", PNG, "image/png")
    data.update(overrides.pop("data", {}))
    files.update(overrides.pop("files", {}))
    return client.post(f"/interviews/{interview_id}/video-answers", headers=headers, data=data, files=files or None)


def _run_to_end(client, headers, started):
    question, body, answers = started["question"], None, 0
    while True:
        response = _answer(client, headers, started["interview_id"], question)
        assert response.status_code == 200, response.text
        body, answers = response.json(), answers + 1
        if body["status"] == "completed":
            return body, answers
        question = body["next_question"]


# --------------------------------------------------------------------------- plans

def test_plan_depends_on_role_family_and_seniority():
    mid = build_plan("Software & Web", "Mid")
    assert [s["type"] for s in mid] == ["intro", "concept", "deep_dive", "coding", "design", "behavioral"]
    assert [s["index"] for s in mid] == list(range(6))
    assert mid[3]["languages"][0] == "python"

    assert "design" not in [s["type"] for s in build_plan("Cloud & DevOps", "Junior")]
    assert build_plan("AI & Data", "Senior")[-1]["type"] == "leadership"
    assert build_plan("AI & Data", "Mid")[4]["title"] == "ML system design"

    core = build_plan("Core Engineering", "Mid")
    assert "coding" not in [s["type"] for s in core]
    assert core[4]["title"] == "Sketch and explain"
    assert [s["title"] for s in core].count("Concept check") == 1   # the second one is "Applied concept"

    assert build_plan("Something new", "Mid") == mid


# --------------------------------------------------------------------------- delivery

def test_filler_words_count_only_real_fillers():
    counts = delivery.count_fillers("Um, so, like, we basically cached it. I like Go. You know, uh, it worked.")
    assert counts == {"um": 1, "uh": 1, "basically": 1, "you know": 1, "like": 1}
    assert delivery.count_fillers("I like the design of the lake") == {}


def test_delivery_record_and_summary():
    record = delivery.build_delivery(json.loads(DELIVERY), SPOKEN, spoken=True)
    assert record["pace"] == round(record["words"] / (36 / 60))
    assert record["pauses"] == [[10.0, 4.2]]            # silences under 3 s are ignored
    assert record["long_pauses"] == 1 and record["longest_pause"] == 4.2
    assert record["fillers"] == {"um": 1}
    assert record["eye_contact"] == 0.7

    junk = delivery.build_delivery({"duration": "abc", "eye_contact": 7, "pauses": "x"}, "hi", spoken=True)
    assert junk["duration"] == 0 and junk["eye_contact"] == 1 and junk["pauses"] == [] and junk["pace"] is None

    # Typed text against a few seconds of audio is not a speaking pace.
    assert delivery.build_delivery({"duration": 4, "speaking": 3}, SPOKEN, spoken=True)["pace"] is None
    assert delivery.build_delivery({"duration": 12, "speaking": 11}, SPOKEN * 3, spoken=True)["pace"] is None

    summary = delivery.summarize([record, record, None])
    assert summary["filler_total"] == 2 and summary["long_pauses"] == 2
    assert summary["pace_target"] == [120, 160]
    assert delivery.summarize([]) is None
    tips = delivery.delivery_tips({**summary, "pace": 140, "fillers": {"basically": 9}, "fillers_per_minute": 3.1, "eye_contact": 0.3})
    assert [t["topic"] for t in tips] == ["Fewer filler words", "Look at the camera more"]


# --------------------------------------------------------------------------- full flow (fallback AI)

def test_full_video_interview_flow(client, user_headers, roles):
    upload_text_resume(client, user_headers, DEVOPS_RESUME)
    started = _start(client, user_headers, _role(roles, "Software & Web"))
    assert started["mode"] == "video"
    assert started["total_questions"] == len(started["plan"]) == 6
    first = started["question"]
    assert first["kind"] == "spoken" and first["step_index"] == 0 and first["parent_id"] is None
    assert "expected_concepts" not in first

    # Intro has no follow-up; the concept step does.
    intro = _answer(client, user_headers, started["interview_id"], first).json()
    assert intro["is_follow_up"] is False and intro["next_question"]["step_index"] == 1
    assert intro["evaluation"]["transcript_source"] == "captions"
    assert intro["delivery"]["fillers"] == {"um": 1}
    concept = _answer(client, user_headers, started["interview_id"], intro["next_question"]).json()
    assert concept["is_follow_up"] is True
    follow_up = concept["next_question"]
    assert follow_up["parent_id"] == intro["next_question"]["id"] and follow_up["step_index"] == 1

    final, answers = _run_to_end(client, user_headers, {"interview_id": started["interview_id"], "question": follow_up})
    assert final["status"] == "completed" and 0 <= final["overall_score"] <= 10
    assert final["questions_answered"] == 6

    results = client.get(f"/interviews/{started['interview_id']}/results", headers=user_headers).json()
    assert results["mode"] == "video" and results["status"] == "completed"
    assert [s["status"] for s in results["steps"]] == ["answered"] * 6
    assert 1 <= results["follow_ups"] <= MAX_FOLLOW_UPS
    code_step = next(s for s in results["steps"] if s["kind"] == "code")
    assert code_step["questions"][0]["answer"]["code"] == CODE
    design_step = next(s for s in results["steps"] if s["kind"] == "design")
    assert design_step["questions"][0]["answer"]["diagram_image"].startswith("data:image/png;base64,")
    assert design_step["questions"][0]["expected_concepts"]            # revealed only in results
    assert results["delivery"]["filler_total"] >= 1
    assert results["recommendations"]

    history = client.get("/interviews/history", headers=user_headers).json()
    row = next(h for h in history if h["id"] == started["interview_id"])
    assert row["mode"] == "video" and row["total_questions"] == 6 and len(row["scores"]) == 6

    summary = client.get("/profile/summary", headers=user_headers).json()
    recent = next(r for r in summary["recent_interviews"] if r["id"] == started["interview_id"])
    assert recent["mode"] == "video" and recent["total"] == 6 and len(recent["questions"]) == 6


def test_follow_ups_are_capped(client, user_headers, roles):
    started = _start(client, user_headers, _role(roles, "Software & Web"), seniority="Senior")
    _, answers = _run_to_end(client, user_headers, started)
    results = client.get(f"/interviews/{started['interview_id']}/results", headers=user_headers).json()
    assert results["follow_ups"] == MAX_FOLLOW_UPS
    assert answers == len(results["plan"]) + MAX_FOLLOW_UPS


def test_video_plan_preview(client, roles):
    role = _role(roles, "Software & Web")
    body = client.get(f"/roles/{role['id']}/video-plan", params={"seniority": "Junior"}).json()
    assert [s["type"] for s in body["plan"]] == ["intro", "concept", "deep_dive", "coding", "behavioral"]
    assert body["minutes"] == 23
    assert client.get("/roles/999999/video-plan").status_code == 404


def test_core_engineering_interview_has_no_coding(client, user_headers, roles):
    started = _start(client, user_headers, _role(roles, "Core Engineering"))
    assert [s["kind"] for s in started["plan"]].count("code") == 0
    assert started["plan"][4]["kind"] == "design"


# --------------------------------------------------------------------------- validation

def test_answer_validation(client, user_headers, roles, monkeypatch):
    started = _start(client, user_headers, _role(roles, "Software & Web"))
    iid, question = started["interview_id"], started["question"]

    assert _answer(client, user_headers, iid, question, data={"text": ""}).status_code == 400
    # With no captions and no AI to transcribe the audio, the candidate is asked to try again or type.
    audio = {"audio": ("answer.wav", b"RIFF0000WAVEfmt ", "audio/wav")}
    silent = _answer(client, user_headers, iid, question, data={"text": ""}, files=audio)
    assert silent.status_code == 422 and "Type your answer" in silent.json()["detail"]
    bad_type = _answer(client, user_headers, iid, question, files={"audio": ("a.txt", b"hello", "text/plain")})
    assert bad_type.status_code == 415
    monkeypatch.setattr(settings, "max_answer_audio_bytes", 10)
    assert _answer(client, user_headers, iid, question, files=audio).status_code == 413
    monkeypatch.undo()
    assert _answer(client, user_headers, iid, question, data={"delivery": "{not json"}).status_code == 400

    # A spoken answer with audio and captions is accepted; the captions become the transcript.
    ok = _answer(client, user_headers, iid, question, files=audio)
    assert ok.status_code == 200, ok.text
    assert _answer(client, user_headers, iid, question).status_code == 409   # already answered

    # Text-interview endpoints refuse video interviews, and the reverse.
    text_answer = client.post(f"/interviews/{iid}/answers", headers=user_headers,
                              json={"question_id": question["id"], "answer_text": SPOKEN})
    assert text_answer.status_code == 409
    text_interview = client.post("/interviews", headers=user_headers, json={"role_id": _role(roles, "Software & Web")["id"]}).json()
    assert text_interview["mode"] == "text" and text_interview["plan"] is None
    wrong = client.post(f"/interviews/{text_interview['interview_id']}/video-answers", headers=user_headers,
                        data={"question_id": str(text_interview["question"]["id"]), "text": SPOKEN})
    assert wrong.status_code == 409


def test_code_and_design_validation(client, user_headers, roles):
    started = _start(client, user_headers, _role(roles, "Software & Web"), seniority="Mid")
    iid, question = started["interview_id"], started["question"]
    while question["kind"] != "code":
        body = _answer(client, user_headers, iid, question).json()
        question = body["next_question"]
    assert question["details"]["prompt"] and question["details"]["languages"]
    assert _answer(client, user_headers, iid, question, data={"code": "  "}).status_code == 400
    assert _answer(client, user_headers, iid, question, data={"language": "cobol"}).status_code == 400
    design = _answer(client, user_headers, iid, question).json()["next_question"]
    assert design["kind"] == "design" and design["details"]["requirements"]
    assert "expected_concepts" not in design
    not_png = _answer(client, user_headers, iid, design, files={"diagram": ("d.png", b"GIF89a", "image/png")})
    assert not_png.status_code == 415


# --------------------------------------------------------------------------- ending early and resuming

def test_finish_early_and_resume(client, user_headers, roles):
    started = _start(client, user_headers, _role(roles, "AI & Data"))
    iid = started["interview_id"]
    resumed = client.post(f"/interviews/{iid}/resume", headers=user_headers).json()
    assert resumed["mode"] == "video" and resumed["plan"] == started["plan"]
    assert resumed["current_question"]["id"] == started["question"]["id"]
    assert resumed["questions_answered"] == 0 and resumed["follow_ups_used"] == 0

    _answer(client, user_headers, iid, started["question"])
    resumed = client.post(f"/interviews/{iid}/resume", headers=user_headers).json()
    assert resumed["questions_answered"] == 1 and resumed["current_question"]["step_index"] == 1
    assert resumed["elapsed_seconds"] == 42

    finished = client.post(f"/interviews/{iid}/finish", headers=user_headers)
    assert finished.status_code == 200, finished.text
    assert finished.json()["questions_answered"] == 1
    results = client.get(f"/interviews/{iid}/results", headers=user_headers).json()
    assert results["status"] == "completed"
    assert [s["status"] for s in results["steps"]] == ["answered"] + ["skipped"] * 5
    assert results["overall_score"] == results["steps"][0]["score"]
    assert client.post(f"/interviews/{iid}/finish", headers=user_headers).status_code == 409
    assert client.post(f"/interviews/{iid}/resume", headers=user_headers).status_code == 409


def test_finish_with_no_answers(client, user_headers, roles):
    started = _start(client, user_headers, _role(roles, "Software & Web"))
    body = client.post(f"/interviews/{started['interview_id']}/finish", headers=user_headers).json()
    assert body["overall_score"] is None and body["questions_answered"] == 0


# --------------------------------------------------------------------------- AI path

@pytest.fixture
def anyio_backend():
    return "asyncio"


class _Question:
    question_text = "How do you keep a cache consistent?"
    expected_concepts = ["Invalidate on write", "TTL"]
    details = None


@pytest.mark.anyio
async def test_ai_evaluation_sends_audio_and_normalizes(monkeypatch):
    seen = {}

    async def fake_generate_json(parts):
        seen["parts"] = parts
        return {
            "transcript": "We delete the key on write, um, and use a TTL.",
            "segments": [{"start": 2.5, "text": "We delete the key on write."}, {"start": 999, "text": "and use a TTL."}, {"text": ""}],
            "score": 12, "correctness": 0.9, "relevance": 2, "completeness": 0.7,
            "detected_concepts": ["Invalidate on write"], "missing_concepts": ["TTL"], "feedback": "Good.",
            "follow_up": "What happens between the write and the delete?",
        }

    monkeypatch.setattr(gemini_service, "client", object())
    monkeypatch.setattr(gemini_service, "generate_json", fake_generate_json)
    step = build_plan("Software & Web", "Mid")[1]
    ctx = {"role_name": "Backend Engineer", "seniority": "Mid", "difficulty": "Medium", "target_skills": [], "candidate_skills": [], "weak_skills": []}
    result = await video_interview.evaluate_answer(
        step, _Question(), None, ctx, audio=b"RIFF", audio_mime="audio/wav", text="", text_source="captions",
        caption_segments=[], code="", language="", image=None, allow_follow_up=True, duration=30,
    )
    assert "Transcribe it word for word" in seen["parts"][0]
    assert seen["parts"][1].inline_data.mime_type == "audio/wav"
    assert result["transcript_source"] == "ai" and result["transcript"].startswith("We delete")
    assert result["score"] == 10 and result["relevance"] == 1
    assert [s["start"] for s in result["segments"]] == [2.5, 35.0]      # clamped to the recording length
    assert result["follow_up"] == "What happens between the write and the delete?"


@pytest.mark.anyio
async def test_ai_code_review_keeps_valid_line_comments(monkeypatch):
    async def fake_generate_json(parts):
        return {"score": 7, "feedback": "Solid.", "criteria": {"correctness": 8, "edge_cases": 40},
                "line_comments": [{"line": 2, "kind": "good", "text": "Nice."}, {"line": 99, "text": "Out of range"},
                                  {"line": "x", "text": "bad"}]}

    monkeypatch.setattr(gemini_service, "client", object())
    monkeypatch.setattr(gemini_service, "generate_json", fake_generate_json)
    step = build_plan("Software & Web", "Mid")[3]
    ctx = {"role_name": "Backend Engineer", "seniority": "Mid", "difficulty": "Medium", "target_skills": [], "candidate_skills": [], "weak_skills": []}
    result = await video_interview.evaluate_answer(
        step, _Question(), None, ctx, audio=None, audio_mime="", text="queue per client", text_source="typed",
        caption_segments=[], code=CODE, language="python", image=None, allow_follow_up=False, duration=0,
    )
    assert result["criteria"] == {"correctness": 8.0, "edge_cases": 10.0}
    assert result["line_comments"] == [{"line": 2, "kind": "good", "text": "Nice."}]
    assert result["follow_up"] is None and result["transcript_source"] == "typed"
