"""
Benchmarks: how a candidate compares with everyone else preparing for the same role.

Nobody's resume is shown here, only aggregates. A figure is only reported when enough
people stand behind it (MIN_COHORT for the whole group, MIN_GROUP for any smaller group or
skill count), so no number can point to one person.

A candidate is "preparing for" a role when they have an active resume and have started at
least one mock interview for it. Demo accounts are left out.

Candidate score (also used to rank the resume showcase):
  60%  role readiness: share of the role's weighted requirements the profile covers
  40%  mock interview average for the role: latest 3 completed interviews, 0-10 scaled to 0-100
A candidate with no completed interview for the role gets 0 for the second part, because
interview answers are much harder to inflate than a list of keywords on a resume.
"""
import math
import re
from dataclasses import dataclass, field
from statistics import mean
from typing import Any, Dict, Iterable, List, Optional, Sequence

from sqlalchemy.orm import Session

from core import models
from core.config import DEMO_EMAIL_DOMAIN
from core.countries import country_payload, guess_resume_country
from .skill_gap import compute_skill_gap
from .skill_taxonomy import index_candidate_skills, match_role_skill

MIN_COHORT = 5           # candidates needed before percentiles and averages are shown
MIN_GROUP = 3            # smallest group (or number of skill holders) any figure may describe
TOP_SHARE = 0.10         # "top candidates" are the top 10% by score
SKILL_SHARE = 0.40       # a skill is suggested when at least 40% of top candidates have it
MAX_SKILL_SUGGESTIONS = 8
INTERVIEWS_AVERAGED = 3
READINESS_WEIGHT = 0.6
INTERVIEW_WEIGHT = 0.4
METRICS = ("readiness", "interview", "score", "projects", "experience", "certifications", "skills", "measurable", "completeness")

# A line that reports an outcome: 40%, 3x, $2M, 10k users, 200 ms, 1,200 requests...
_METRIC = re.compile(
    r"\d+(?:\.\d+)?\s?(?:%|percent\b|x\b|×)"
    r"|[$₹€£]\s?\d"
    r"|\b\d[\d,.]*\s?(?:k|m|mn|million|billion|lakh|crore)?\+?\s+"
    r"(?:users|customers|clients|requests|transactions|downloads|students|members|visitors|records|rows|queries|"
    r"servers|services|ms|milliseconds|seconds|minutes|hours|days|weeks|people|teams|engineers|countries|cities|"
    r"orders|sales|leads|stars)\b",
    re.IGNORECASE,
)
_GRADE_LINE = re.compile(r"\b(?:cgpa|gpa|sgpa|percentage|marks|grade|class\s+(?:x|xii|10|12)|10th|12th|hsc|ssc|cbse)\b", re.IGNORECASE)


def is_demo(user: models.User) -> bool:
    return (user.email or "").lower().endswith("@" + DEMO_EMAIL_DOMAIN)


def suggest_country(resume: Optional[models.Resume]) -> Optional[str]:
    """A country to offer when the user has not chosen one; they always confirm it."""
    if resume is None:
        return None
    personal = (resume.parsed_profile_json or {}).get("personal_info") or {}
    return guess_resume_country(personal.get("location"), resume.raw_text)


def role_requirements(role: Optional[models.Role]) -> List[tuple]:
    if role is None:
        return []
    return [(rs.skill.canonical_name, rs.importance_weight or 1.0) for rs in role.role_skills if rs.skill]


def measurable_results(text: Optional[str]) -> int:
    """Lines of the resume that state a measurable outcome (grades are not outcomes)."""
    count = 0
    for line in (text or "").splitlines():
        if _METRIC.search(line) and not _GRADE_LINE.search(line):
            count += 1
    return count


def _list(value: Any) -> list:
    return value if isinstance(value, list) else []


def merge_skills(*groups: Iterable[str]) -> List[str]:
    names: List[str] = []
    seen = set()
    for group in groups:
        for name in group or []:
            if name and name.lower() not in seen:
                seen.add(name.lower())
                names.append(name)
    return names


def resume_counts(resume: models.Resume) -> Dict[str, int]:
    profile = resume.parsed_profile_json if isinstance(resume.parsed_profile_json, dict) else {}
    quality = resume.quality_analysis_json if isinstance(resume.quality_analysis_json, dict) else {}
    return {
        "projects": len(_list(profile.get("projects"))),
        "experience": len(_list(profile.get("experience"))),
        "certifications": len(_list(profile.get("certifications"))),
        "measurable": measurable_results(resume.raw_text),
        "completeness": int(quality.get("completeness_score") or 0),
    }


def readiness_for(role: models.Role, requirements: Sequence[tuple], skills: Sequence[str]) -> float:
    return compute_skill_gap(role.name, requirements, skills)["readiness_score"]


def candidate_score(readiness: float, interview: Optional[float]) -> float:
    return round(READINESS_WEIGHT * readiness + INTERVIEW_WEIGHT * (interview or 0) * 10, 1)


def interview_averages(db: Session, role_id: int, user_ids: Optional[Iterable[int]] = None) -> Dict[int, float]:
    """Each user's average over their latest completed interviews for the role (0-10)."""
    query = db.query(models.Interview.user_id, models.Interview.overall_score).filter(
        models.Interview.role_id == role_id,
        models.Interview.status == "completed",
        models.Interview.overall_score.isnot(None),
    )
    if user_ids is not None:
        query = query.filter(models.Interview.user_id.in_(list(user_ids)))
    rows = query.order_by(models.Interview.completed_at.desc(), models.Interview.id.desc()).all()
    latest: Dict[int, List[float]] = {}
    for user_id, score in rows:
        scores = latest.setdefault(user_id, [])
        if len(scores) < INTERVIEWS_AVERAGED:
            scores.append(score)
    return {user_id: round(mean(scores), 1) for user_id, scores in latest.items()}


def extra_skills(db: Session, user_ids: Iterable[int]) -> Dict[int, List[str]]:
    """Skills from sources other than the resume (GitHub), per user."""
    ids = list(user_ids)
    if not ids:
        return {}
    rows = (
        db.query(models.CandidateSkill.user_id, models.Skill.canonical_name)
        .join(models.Skill, models.Skill.id == models.CandidateSkill.skill_id)
        .filter(models.CandidateSkill.user_id.in_(ids), models.CandidateSkill.source != "resume")
        .all()
    )
    result: Dict[int, List[str]] = {}
    for user_id, name in rows:
        result.setdefault(user_id, []).append(name)
    return result


@dataclass
class Candidate:
    user_id: int
    country: Optional[str]
    skills: List[str]
    metrics: Dict[str, Optional[float]] = field(default_factory=dict)


def _candidate(user: models.User, resume: models.Resume, extra: List[str], role: models.Role,
               requirements: Sequence[tuple], interview: Optional[float]) -> Candidate:
    skills = merge_skills(resume.extracted_skills_json or [], extra)
    readiness = readiness_for(role, requirements, skills)
    metrics: Dict[str, Optional[float]] = {
        "readiness": readiness,
        "interview": interview,
        "score": candidate_score(readiness, interview),
        "skills": len(skills),
        **resume_counts(resume),
    }
    return Candidate(user_id=user.id, country=user.country, skills=skills, metrics=metrics)


def load_cohort(db: Session, role: models.Role, exclude_user_id: Optional[int] = None) -> List[Candidate]:
    preparing = db.query(models.Interview.user_id).filter(models.Interview.role_id == role.id).distinct()
    rows = (
        db.query(models.User, models.Resume)
        .join(models.Resume, models.Resume.user_id == models.User.id)
        .filter(
            models.Resume.is_active.is_(True),
            models.User.id.in_(preparing),
            ~models.User.email.like(f"%@{DEMO_EMAIL_DOMAIN}"),
        )
        .order_by(models.Resume.id.desc())
        .all()
    )
    latest: Dict[int, tuple] = {}
    for user, resume in rows:
        if user.id != exclude_user_id:
            latest.setdefault(user.id, (user, resume))
    requirements = role_requirements(role)
    extras = extra_skills(db, latest)
    interviews = interview_averages(db, role.id, latest)
    return [
        _candidate(user, resume, extras.get(user.id, []), role, requirements, interviews.get(user.id))
        for user, resume in latest.values()
    ]


def _percentile(value: Optional[float], others: Sequence[float]) -> Optional[int]:
    """Percentile rank among `others`: those below count fully and ties count half, so a
    candidate level with everyone sits at the 50th percentile rather than the 0th."""
    if value is None or not others:
        return None
    below = sum(1 for o in others if o < value)
    level = sum(1 for o in others if o == value)
    return round((below + level / 2) / len(others) * 100)


def _averages(group: Sequence[Candidate]) -> Dict[str, Optional[float]]:
    result: Dict[str, Optional[float]] = {}
    for metric in METRICS:
        values = [c.metrics[metric] for c in group if c.metrics.get(metric) is not None]
        result[metric] = round(mean(values), 1) if len(values) >= MIN_GROUP else None
    return result


def _skills_to_add(top: Sequence[Candidate], your_skills: Sequence[str], requirements: Sequence[tuple]) -> List[Dict[str, Any]]:
    holders: Dict[str, int] = {}
    names: Dict[str, str] = {}
    for candidate in top:
        for skill in {s.lower(): s for s in candidate.skills}.values():
            holders[skill.lower()] = holders.get(skill.lower(), 0) + 1
            names.setdefault(skill.lower(), skill)
    yours = index_candidate_skills(your_skills)
    suggestions = []
    for key, count in holders.items():
        share = count / len(top)
        if count < MIN_GROUP or share < SKILL_SHARE:
            continue
        name = names[key]
        if match_role_skill(name, yours):
            continue
        single = index_candidate_skills([name])
        suggestions.append({
            "name": name,
            "share": round(share * 100),
            "required": any(match_role_skill(req, single) for req, _ in requirements),
        })
    suggestions.sort(key=lambda s: (-s["share"], not s["required"], s["name"].lower()))
    return suggestions[:MAX_SKILL_SUGGESTIONS]


def _country_counts(cohort: Sequence[Candidate], your_country: Optional[str]) -> List[Dict[str, Any]]:
    counts: Dict[str, int] = {}
    for candidate in cohort:
        if candidate.country:
            counts[candidate.country] = counts.get(candidate.country, 0) + 1
    listed = [
        {**country_payload(code), "candidates": n}
        for code, n in counts.items()
        if country_payload(code) and (n >= MIN_COHORT or code == your_country)
    ]
    if your_country and country_payload(your_country) and your_country not in counts:
        listed.append({**country_payload(your_country), "candidates": 0})
    listed.sort(key=lambda c: (-c["candidates"], c["name"]))
    return listed


def build_benchmarks(db: Session, user: models.User, role: models.Role, country: Optional[str] = None) -> Dict[str, Any]:
    requirements = role_requirements(role)
    resume = (
        db.query(models.Resume)
        .filter(models.Resume.user_id == user.id, models.Resume.is_active.is_(True))
        .order_by(models.Resume.id.desc())
        .first()
    )
    interview = interview_averages(db, role.id, [user.id]).get(user.id)
    you: Optional[Candidate] = None
    if resume:
        you = _candidate(user, resume, extra_skills(db, [user.id]).get(user.id, []), role, requirements, interview)

    everyone = load_cohort(db, role, exclude_user_id=user.id)
    cohort = [c for c in everyone if c.country == country] if country else everyone

    result: Dict[str, Any] = {
        "role": {"id": role.id, "name": role.name},
        "scope": country_payload(country),
        "your_country": country_payload(user.country),
        "suggested_country": None if user.country else country_payload(suggest_country(resume)),
        "countries": _country_counts(everyone, user.country),
        "has_resume": resume is not None,
        "has_interview": interview is not None,
        "weights": {"readiness": READINESS_WEIGHT, "interview": INTERVIEW_WEIGHT},
        "min_cohort": MIN_COHORT,
        "cohort_size": len(cohort),
        "enough": len(cohort) >= MIN_COHORT,
        "you": you.metrics if you else None,
        "percentiles": None,
        "distribution": None,
        "top": None,
        "everyone": None,
        "skills_to_add": [],
    }
    if not result["enough"]:
        return result

    ranked = sorted(cohort, key=lambda c: -c.metrics["score"])
    natural = math.ceil(len(ranked) * TOP_SHARE)
    top = ranked[:max(MIN_GROUP, natural)]
    buckets = [0] * 10
    for candidate in cohort:
        buckets[min(9, int(candidate.metrics["score"] // 10))] += 1

    result["top"] = {
        "label": "Top 10%" if natural >= MIN_GROUP else f"Top {len(top)}",
        "size": len(top),
        "averages": _averages(top),
    }
    result["everyone"] = {"size": len(cohort), "averages": _averages(cohort)}
    result["distribution"] = {
        "buckets": buckets,
        "you": min(9, int(you.metrics["score"] // 10)) if you else None,
    }
    if you:
        interviews = [c.metrics["interview"] for c in cohort if c.metrics["interview"] is not None]
        result["percentiles"] = {
            "score": _percentile(you.metrics["score"], [c.metrics["score"] for c in cohort]),
            "readiness": _percentile(you.metrics["readiness"], [c.metrics["readiness"] for c in cohort]),
            "interview": _percentile(interview, interviews) if len(interviews) >= MIN_COHORT else None,
            "interview_candidates": len(interviews),
        }
    result["skills_to_add"] = _skills_to_add(top, you.skills if you else [], requirements)
    return result
