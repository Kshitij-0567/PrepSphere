"""
Everything the Profile page shows, built in one pass from the user's real data:
identity, linked profiles, the active resume, readiness and skill-sphere nodes for their
current target role, interview statistics, rubric averages, insights, recent interviews,
the next step and a study plan.

The target role is the role of the user's most recent interview (plus that interview's
job-description skills), because that is what they are currently preparing for.
"""
from statistics import mean
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from core import models
from core.config import QUESTIONS_PER_INTERVIEW
from .candidate_profile import candidate_skill_names, get_active_resume, github_skill_names, resume_skills
from .skill_gap import compute_skill_gap, merge_jd_requirements
from .skill_taxonomy import extract_skills_with_evidence

MAX_EXTRA_NODES = 12
PRIORITY_ORDER = {"High": 0, "Medium": 1, "Low": 2}
RUBRIC_DIMENSIONS = ("relevance", "correctness", "completeness")
DIMENSION_ADVICE = {
    "completeness": "Answers often stop early. Close with failure handling and edge cases.",
    "correctness": "Some technical details were off. Double-check definitions and trade-offs.",
    "relevance": "Answers drift from the question. Address what was asked before adding context.",
}


def _iso(value) -> Optional[str]:
    return value.isoformat() + "Z" if value else None


def _initials(name: Optional[str], email: str) -> str:
    words = (name or email.split("@")[0]).replace(".", " ").replace("_", " ").split()
    if not words:
        return "?"
    if len(words) == 1:
        return words[0][:2].upper()
    return (words[0][0] + words[-1][0]).upper()


def _excerpt(text: str, limit: int = 110) -> str:
    text = " ".join((text or "").split())
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def _role_requirements(role: Optional[models.Role]) -> List[tuple]:
    if role is None:
        return []
    return [(rs.skill.canonical_name, rs.importance_weight or 1.0) for rs in role.role_skills if rs.skill]


def _profile_items(items: Any, title_key: str, parts: List[str], limit: int) -> List[Dict[str, str]]:
    result = []
    for item in items if isinstance(items, list) else []:
        if not isinstance(item, dict):
            continue
        title = str(item.get(title_key) or "").strip()
        if not title:
            continue
        subtitle = " · ".join(str(item.get(p)).strip() for p in parts if item.get(p))
        result.append({"title": title, "subtitle": subtitle})
        if len(result) == limit:
            break
    return result


def _interview_questions(interview: models.Interview) -> Dict[str, Any]:
    """One cell per question (text interviews) or per step (video interviews) for the score strip."""
    questions = sorted(interview.questions, key=lambda q: q.id)
    answers = {a.question_id: a for a in interview.answers}
    live = interview.status != "completed"
    cells: List[Dict[str, Any]] = []
    current_index = None
    if (interview.mode or "text") == "video":
        for index, step in enumerate(interview.plan or []):
            step_questions = [q for q in questions if q.step_index == step["index"]]
            main = next((q for q in step_questions if not q.parent_id), None)
            scored = [answers[q.id] for q in step_questions if q.id in answers and answers[q.id].score is not None]
            if live and current_index is None and any(q.id not in answers for q in step_questions):
                current_index = index
            cells.append({
                "score": round(sum(a.score for a in scored) / len(scored), 1) if scored else None,
                "topic": _excerpt(main.question_text) if main else step.get("title"),
                "approx": any((a.rubric_json or {}).get("evaluator") == "fallback" for a in scored),
            })
        total = len(cells)
    else:
        for index, question in enumerate(questions[:QUESTIONS_PER_INTERVIEW]):
            answer = answers.get(question.id)
            if answer is None and current_index is None and live:
                current_index = index
            rubric = (answer.rubric_json or {}) if answer else {}
            cells.append({
                "score": answer.score if answer else None,
                "topic": _excerpt(question.question_text),
                "approx": rubric.get("evaluator") == "fallback",
            })
        while len(cells) < QUESTIONS_PER_INTERVIEW:
            cells.append({"score": None, "topic": None, "approx": False})
        total = QUESTIONS_PER_INTERVIEW
    answered = sum(1 for c in cells if c["score"] is not None)
    return {"questions": cells, "answered": answered, "current_index": current_index, "total": total}


def build_profile_summary(db: Session, user: models.User) -> Dict[str, Any]:
    resume = get_active_resume(db, user)
    profile = (resume.parsed_profile_json or {}) if resume else {}
    quality = (resume.quality_analysis_json or {}) if resume else {}

    interviews = (
        db.query(models.Interview)
        .filter(models.Interview.user_id == user.id)
        .order_by(models.Interview.started_at.desc(), models.Interview.id.desc())
        .all()
    )
    completed = [i for i in interviews if i.status == "completed" and i.overall_score is not None]
    completed.sort(key=lambda i: (i.completed_at or i.started_at, i.id))
    in_progress = [i for i in interviews if i.status != "completed"]
    answers = [a for i in interviews for a in i.answers]

    # --- identity, links, resume ---
    personal = profile.get("personal_info") or {}
    summary: Dict[str, Any] = {
        "user": {
            "id": user.id,
            "name": user.name or user.email.split("@")[0],
            "email": user.email,
            "initials": _initials(user.name, user.email),
            "location": personal.get("location"),
            "member_since": _iso(user.created_at),
        },
        "links": {
            "linkedin": user.linkedin_handle,
            "linkedin_url": f"https://www.linkedin.com/in/{user.linkedin_handle}" if user.linkedin_handle else None,
            "github": user.github_username,
            "github_url": f"https://github.com/{user.github_username}" if user.github_username else None,
        },
        "github": user.github_data if user.github_username else None,
        "resume": None,
    }
    resume_skill_list = resume_skills(resume) if resume else []
    if resume:
        summary["resume"] = {
            "id": resume.id,
            "filename": resume.filename or f"Resume #{resume.id}",
            "completeness": quality.get("completeness_score"),
            "uploaded_at": _iso(resume.uploaded_at),
            "skills": resume_skill_list,
            "experience": _profile_items(profile.get("experience"), "role", ["company", "duration"], 3),
            "education": _profile_items(profile.get("education"), "degree", ["institution", "graduation_year"], 2),
        }

    # --- target role, readiness, skill sphere ---
    target_interview = next((i for i in interviews if i.role is not None), None)
    summary["target"] = None
    summary["readiness"] = None
    summary["sphere"] = {"nodes": []}
    missing_high: List[str] = []
    if target_interview:
        role = target_interview.role
        requirements = merge_jd_requirements(_role_requirements(role), target_interview.jd_skills or [])
        candidate = candidate_skill_names(db, user, resume)
        gap = compute_skill_gap(role.name, requirements, candidate, resume.raw_text if resume else None)

        github_only = {s.lower() for s in github_skill_names(db, user)} - {s.lower() for s in resume_skill_list}
        mentions = {s["name"].lower(): s["mentions"] for s in extract_skills_with_evidence(resume.raw_text)} if resume and resume.raw_text else {}
        used = set()
        nodes = []
        covered = total = 0.0
        for detail in gap["skill_details"]:
            via = detail["matched_via"]
            used.update(v.lower() for v in via)
            total += detail["importance_weight"]
            if detail["status"] in ("strong", "developing"):
                covered += detail["importance_weight"]
            if detail["status"] == "missing":
                missing_high.append(detail["name"])
            nodes.append({
                "name": detail["name"],
                "status": detail["status"],
                "weight": detail["importance_weight"],
                "mentions": sum(mentions.get(v.lower(), 0) for v in via),
                "via": via,
                "github": bool(via) and all(v.lower() in github_only for v in via),
                "required": True,
            })
        extras = [s for s in candidate if s.lower() not in used]
        extras.sort(key=lambda s: -mentions.get(s.lower(), 0))
        for skill in extras[:MAX_EXTRA_NODES]:
            nodes.append({
                "name": skill, "status": "extra", "weight": None,
                "mentions": mentions.get(skill.lower(), 0), "via": [skill],
                "github": skill.lower() in github_only, "required": False,
            })
        summary["target"] = {
            "role_id": role.id,
            "role_name": role.name,
            "seniority": target_interview.seniority or "Mid",
            "company_id": target_interview.company_id,
            "company_name": target_interview.company.name if target_interview.company else None,
            "jd_skill_count": len(target_interview.jd_skills or []),
        }
        summary["readiness"] = {"score": gap["readiness_score"], "covered": round(covered, 1), "total": round(total, 1)}
        summary["sphere"] = {"nodes": nodes}

    # --- interview statistics ---
    scores = [i.overall_score for i in completed]
    stats: Dict[str, Any] = {
        "completed": len(completed),
        "in_progress": len(in_progress),
        "total": len(interviews),
        "answers_scored": sum(1 for a in answers if a.score is not None),
        "average": round(mean(scores), 1) if scores else None,
        "first": scores[0] if scores else None,
        "latest": scores[-1] if scores else None,
        "delta": round(scores[-1] - scores[0], 1) if len(scores) >= 2 else None,
        "trend": [
            {
                "interview_id": i.id,
                "date": _iso(i.completed_at or i.started_at),
                "score": i.overall_score,
                "role": i.role.name if i.role else "Interview",
                "company": i.company.name if i.company else None,
            }
            for i in completed
        ],
    }
    summary["stats"] = stats

    # --- rubric averages ---
    rubric_values = {d: [] for d in RUBRIC_DIMENSIONS}
    for answer in answers:
        rubric = answer.rubric_json or {}
        for d in RUBRIC_DIMENSIONS:
            value = rubric.get(d)
            if isinstance(value, (int, float)):
                rubric_values[d].append(float(value))
    if all(rubric_values[d] for d in RUBRIC_DIMENSIONS):
        averages = {d: round(mean(v), 2) for d, v in rubric_values.items()}
        summary["quality"] = {**averages, "answers": len(rubric_values["relevance"]), "lowest": min(averages, key=averages.get)}
    else:
        summary["quality"] = None

    # --- insights ---
    insights: List[Dict[str, str]] = []
    scored_answers = [a for a in answers if a.score is not None and a.question]
    if scored_answers:
        best = max(scored_answers, key=lambda a: a.score)
        if best.score >= 7:
            insights.append({"kind": "good", "title": f"Your best answer scored {best.score:.1f}", "text": _excerpt(best.question.question_text, 120)})
        else:
            insights.append({"kind": "accent", "title": f"Highest score so far: {best.score:.1f}", "text": f"On: {_excerpt(best.question.question_text, 110)}"})
    if summary["quality"] and summary["quality"]["answers"] >= 3:
        lowest = summary["quality"]["lowest"]
        insights.append({
            "kind": "warn",
            "title": f"{lowest.title()} is your lowest rubric score",
            "text": DIMENSION_ADVICE[lowest],
        })
    if stats["delta"] is not None:
        first_date, last_date = completed[0], completed[-1]
        direction = "Up" if stats["delta"] >= 0 else "Down"
        insights.append({
            "kind": "accent" if stats["delta"] >= 0 else "warn",
            "title": f"{direction} {abs(stats['delta']):.1f} points since your first interview",
            "text": f"From {stats['first']:.1f} to {stats['latest']:.1f} across {len(completed)} completed interviews.",
            "first_date": _iso(first_date.completed_at or first_date.started_at),
            "last_date": _iso(last_date.completed_at or last_date.started_at),
        })
    if summary["target"]:
        if missing_high:
            insights.append({
                "kind": "crit",
                "title": f"Next focus: {missing_high[0]}",
                "text": f"Required for {summary['target']['role_name']} and not on your resume yet.",
            })
        else:
            insights.append({"kind": "good", "title": "No required skills missing", "text": f"Your profile covers every high-priority skill for {summary['target']['role_name']}."})
    if not interviews:
        insights.append({"kind": "accent", "title": "Take your first mock interview", "text": "Pick a role in the Workspace to get questions, scores and a study plan."})
    summary["insights"] = insights[:4]

    # --- recent interviews and next step ---
    recent = []
    for interview in interviews[:3]:
        cells = _interview_questions(interview)
        recent.append({
            "id": interview.id,
            "role": interview.role.name if interview.role else "Interview",
            "company": interview.company.name if interview.company else None,
            "seniority": interview.seniority or "Mid",
            "date": _iso(interview.started_at),
            "status": interview.status,
            "overall": interview.overall_score,
            "mode": interview.mode or "text",
            **cells,
        })
    summary["recent_interviews"] = recent

    summary["next_step"] = None
    for interview in in_progress:
        cells = _interview_questions(interview)
        if cells["current_index"] is not None:
            summary["next_step"] = {
                "interview_id": interview.id,
                "role": interview.role.name if interview.role else "Interview",
                "company": interview.company.name if interview.company else None,
                "seniority": interview.seniority or "Mid",
                "answered": cells["answered"],
                "total": cells["total"],
                "mode": interview.mode or "text",
                "question": cells["questions"][cells["current_index"]]["topic"],
                "started_at": _iso(interview.started_at),
            }
            break

    # --- study plan ---
    plan: List[Dict[str, Any]] = []
    latest_done = completed[-1] if completed else None
    if latest_done:
        for rec in sorted(latest_done.recommendations, key=lambda r: (PRIORITY_ORDER.get(r.priority, 1), r.id)):
            if rec.topic:
                plan.append({
                    "priority": rec.priority if rec.priority in PRIORITY_ORDER else "Medium",
                    "topic": rec.topic,
                    "reason": rec.reason or "",
                    "source": "interview",
                    "date": _iso(latest_done.completed_at or latest_done.started_at),
                })
    for skill in missing_high:
        if len(plan) >= 5:
            break
        if any(skill.lower() in item["topic"].lower() for item in plan):
            continue
        plan.append({
            "priority": "High",
            "topic": f"Build hands-on experience with {skill}",
            "reason": f"Required for {summary['target']['role_name']} and not on your resume yet.",
            "source": "skill_gap",
            "date": None,
        })
    summary["study_plan"] = plan[:5]
    return summary
