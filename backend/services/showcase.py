"""
Resume showcase: resumes their owners chose to publish, ranked per role.

Publishing makes a redacted copy of the active resume. The copy never contains the owner's
name (unless they choose to show it), email, phone number, links or street address, and by
default it also hides college and company names. Free text is scrubbed of anything that
looks like contact details, plus the owner's own name, handles and links wherever they
appear. The owner sees exactly this copy before it goes live and can remove it at any time.

Readiness is recomputed from the copy's skills and the interview average is read live, so
the ranking stays current; it uses the same score as benchmarks (services/benchmarks.py).
"""
import hashlib
import re
import secrets
from typing import Any, Dict, Iterable, List, Optional, Sequence

from sqlalchemy.orm import Session, selectinload

from core import models
from core.config import settings
from core.countries import country_payload
from .benchmarks import (
    candidate_score, extra_skills, interview_averages, measurable_results, merge_skills, readiness_for,
    role_requirements,
)
from .skill_gap import compute_skill_gap
from .skill_taxonomy import categorize_skills, index_candidate_skills, match_role_skill

REPORTS_TO_HIDE = 3
REPORT_REASONS = {
    "personal_details": "Shows personal details",
    "offensive": "Offensive or inappropriate",
    "fake": "Fake or spam",
}
MAX_ITEMS = 8
MAX_POINTS = 6
MAX_TEXT = 400
TOP_SKILLS = 6

_ADJECTIVES = (
    "Amber", "Brisk", "Bright", "Calm", "Clever", "Cobalt", "Crisp", "Daring", "Eager", "Gentle", "Golden",
    "Keen", "Lucid", "Lunar", "Nimble", "Noble", "Quiet", "Rapid", "Silver", "Steady", "Swift", "Vivid",
)
_NOUNS = (
    "Falcon", "Cedar", "Comet", "Delta", "Ember", "Fjord", "Harbor", "Heron", "Lynx", "Maple", "Meteor",
    "Orbit", "Otter", "Pine", "Quartz", "Raven", "Ridge", "Sparrow", "Summit", "Tide", "Willow", "Zephyr",
)

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
_URL_EXPLICIT = re.compile(
    r"(?:https?://|www\.)\S+"
    r"|\b[\w-]+\.(?:github\.io|vercel\.app|netlify\.app|pages\.dev|herokuapp\.com|onrender\.com)\b\S*",
    re.IGNORECASE,
)
# Lower-case domains only, so tech names such as "Node.js/Express" or "ASP.NET/Core" survive.
_URL_DOMAIN = re.compile(
    r"\b[\w-]+(?:\.[\w-]+)*\.(?:com|org|net|io|in|co|ai|app|edu|info)/\S*"
    r"|\b[\w-]+\.(?:dev|me|xyz|site|tech|page|online|codes)\b"
)
_PROFILE_HOST = re.compile(
    r"\b(?:linkedin|github|gitlab|leetcode|hackerrank|codeforces|codechef|kaggle|medium|behance|dribbble|"
    r"twitter|instagram|x)\.com\b\S*",
    re.IGNORECASE,
)
_HANDLE = re.compile(r"(?<![\w.])@[A-Za-z0-9_]{2,}")
_PHONE_CANDIDATE = re.compile(r"\+?\d[\d\s()-]{7,}\d")


def _strings(values: Iterable[Any]) -> List[str]:
    """Distinct non-trivial strings, longest first so a longer match wins over its parts."""
    return sorted({v.strip() for v in values if isinstance(v, str) and len(v.strip()) >= 3}, key=len, reverse=True)


class Redactor:
    """Removes contact details, the owner's identifying strings and any college or company
    names the owner chose to hide, from free text."""

    def __init__(self, user: models.User, personal: Dict[str, Any],
                 companies: Iterable[str] = (), institutions: Iterable[str] = ()):
        self.terms = _strings([
            user.email, user.linkedin_handle, user.github_username,
            personal.get("email"), personal.get("phone"), personal.get("linkedin"),
            personal.get("github"), personal.get("portfolio"),
        ])
        self.hidden = [(name, "[company]") for name in _strings(companies)] + [(name, "[college]") for name in _strings(institutions)]
        names = {n.strip() for n in (user.name, personal.get("name")) if isinstance(n, str) and n.strip()}
        self.full_names = sorted(names, key=len, reverse=True)
        # Single name parts are only removed when written with a capital letter, so ordinary words survive.
        self.name_parts = sorted({p for n in names for p in n.split() if len(p) >= 3 and p[0].isupper()}, key=len, reverse=True)

    def text(self, value: Any, limit: int = MAX_TEXT) -> Optional[str]:
        if not isinstance(value, str):
            return None
        text = " ".join(value.split())
        for term in self.terms:
            text = re.sub(re.escape(term), "[hidden]", text, flags=re.IGNORECASE)
        for name, placeholder in self.hidden:
            text = re.sub(rf"(?<!\w){re.escape(name)}(?!\w)", placeholder, text, flags=re.IGNORECASE)
        text = _EMAIL.sub("[email hidden]", text)
        text = _PROFILE_HOST.sub("[link hidden]", text)
        text = _URL_EXPLICIT.sub("[link hidden]", text)
        text = _URL_DOMAIN.sub("[link hidden]", text)
        text = _HANDLE.sub("[handle hidden]", text)
        text = _PHONE_CANDIDATE.sub(lambda m: "[phone hidden]" if 10 <= sum(ch.isdigit() for ch in m.group()) <= 15 else m.group(), text)
        for name in self.full_names:
            text = re.sub(rf"(?<!\w){re.escape(name)}(?!\w)", "[name]", text, flags=re.IGNORECASE)
        for part in self.name_parts:
            text = re.sub(rf"(?<!\w){re.escape(part)}(?!\w)", "[name]", text)
        text = text.strip()
        if len(text) > limit:
            text = text[: limit - 1].rstrip() + "…"
        return text or None

    def names(self, values: Any, limit: int = 12) -> List[str]:
        result = []
        for value in values if isinstance(values, list) else []:
            cleaned = self.text(value, 60)
            if cleaned and cleaned not in result:
                result.append(cleaned)
        return result[:limit]


def _items(value: Any) -> List[Dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)][:MAX_ITEMS] if isinstance(value, list) else []


def build_content(user: models.User, resume: models.Resume, github_skills: Sequence[str],
                  show_institutions: bool, show_companies: bool) -> Dict[str, Any]:
    """The redacted copy of a resume that other users see."""
    profile = resume.parsed_profile_json if isinstance(resume.parsed_profile_json, dict) else {}
    quality = resume.quality_analysis_json if isinstance(resume.quality_analysis_json, dict) else {}
    personal = profile.get("personal_info") if isinstance(profile.get("personal_info"), dict) else {}
    r = Redactor(
        user, personal,
        companies=[] if show_companies else [i.get("company") for i in _items(profile.get("experience"))],
        institutions=[] if show_institutions else [i.get("institution") for i in _items(profile.get("education"))],
    )

    skills = [s for s in (resume.extracted_skills_json or profile.get("skills") or []) if isinstance(s, str)]
    github_only = [s for s in merge_skills(skills, github_skills)[len(skills):]]
    experience = []
    for item in _items(profile.get("experience")):
        points = item.get("responsibilities") or item.get("achievements") or []
        experience.append({
            "role": r.text(item.get("role"), 120) or "Role",
            "company": r.text(item.get("company"), 120) if show_companies else None,
            "duration": r.text(item.get("duration"), 60),
            "points": [p for p in (r.text(p, 240) for p in (points if isinstance(points, list) else [])[:MAX_POINTS]) if p],
            "technologies": r.names(item.get("technologies")),
        })
    projects = []
    for item in _items(profile.get("projects")):
        name = r.text(item.get("name"), 120)
        if not name:
            continue
        projects.append({
            "name": name,
            "description": r.text(item.get("description")),
            "technologies": r.names(item.get("technologies")),
            "domain": r.text(item.get("domain"), 80),
        })
    education = []
    for item in _items(profile.get("education")):
        degree = r.text(item.get("degree"), 140)
        if not degree:
            continue
        education.append({
            "degree": degree,
            "field": r.text(item.get("field"), 120),
            "institution": r.text(item.get("institution"), 140) if show_institutions else None,
            "year": r.text(item.get("graduation_year"), 20),
            "grade": r.text(item.get("grade"), 40),
        })
    certifications = [
        {"name": r.text(item.get("name"), 160), "issuer": r.text(item.get("issuer"), 100), "year": r.text(item.get("year"), 20)}
        for item in _items(profile.get("certifications"))
        if r.text(item.get("name"), 160)
    ]
    return {
        "skills": skills,
        "github_skills": github_only,
        "skill_groups": categorize_skills(skills),
        "experience": experience,
        "projects": projects,
        "education": education,
        "certifications": certifications,
        "stats": {
            "projects": len(projects),
            "experience": len(experience),
            "certifications": len(certifications),
            "skills": len(merge_skills(skills, github_only)),
            "measurable": measurable_results(resume.raw_text),
            "completeness": int(quality.get("completeness_score") or 0),
        },
    }


def new_public_id(db: Session) -> str:
    while True:
        value = secrets.token_urlsafe(9)
        if not db.query(models.ResumeShowcase.id).filter(models.ResumeShowcase.public_id == value).first():
            return value


def handle_for(user_id: int) -> str:
    """The user's anonymous name. Derived from the server secret, so it is the same in the preview,
    after publishing and after republishing, and cannot be traced back to the account."""
    digest = hashlib.sha256(f"{settings.secret_key}:showcase-handle:{user_id}".encode()).digest()
    number = 10 + int.from_bytes(digest[2:4], "big") % 90
    return f"{_ADJECTIVES[digest[0] % len(_ADJECTIVES)]} {_NOUNS[digest[1] % len(_NOUNS)]} {number}"


def shown_country(showcase: models.ResumeShowcase) -> Optional[str]:
    return showcase.user.country if (showcase.options or {}).get("show_country", True) else None


def all_skills(content: Dict[str, Any]) -> List[str]:
    return merge_skills(content.get("skills") or [], content.get("github_skills") or [])


def _card(showcase: models.ResumeShowcase) -> Dict[str, Any]:
    """The fields an entry is built from, read off a saved showcase."""
    return {
        "public_id": showcase.public_id,
        "user_id": showcase.user_id,
        "name": showcase.user.name if showcase.show_name and showcase.user.name else showcase.handle,
        "anonymous": not showcase.show_name,
        "country": shown_country(showcase),
        "seniority": showcase.seniority,
        "role": showcase.role,
        "content": showcase.content or {},
        "updated_at": showcase.updated_at,
    }


def _entry(card: Dict[str, Any], interview: Optional[float], viewer_id: int) -> Dict[str, Any]:
    content = card["content"]
    stats = content.get("stats") or {}
    role = card["role"]
    gap = compute_skill_gap(role.name, role_requirements(role), all_skills(content))
    matched = {v.lower() for d in gap["skill_details"] for v in d["matched_via"]}
    skills = content.get("skills") or []
    readiness = gap["readiness_score"]
    return {
        "public_id": card["public_id"],
        "name": card["name"],
        "anonymous": card["anonymous"],
        "country": country_payload(card["country"]),
        "seniority": card["seniority"],
        "role": {"id": role.id, "name": role.name},
        "readiness": readiness,
        "interview": interview,
        "score": candidate_score(readiness, interview),
        # Skills that count for the role first, so the list shows what matters.
        "top_skills": sorted(skills, key=lambda s: s.lower() not in matched)[:TOP_SKILLS],
        "projects": stats.get("projects", 0),
        "experience": stats.get("experience", 0),
        "certifications": stats.get("certifications", 0),
        "measurable": stats.get("measurable", 0),
        "completeness": stats.get("completeness", 0),
        "updated_at": card["updated_at"].isoformat() + "Z" if card["updated_at"] else None,
        "is_you": card["user_id"] == viewer_id,
    }


def _with_content(entry: Dict[str, Any], content: Dict[str, Any]) -> Dict[str, Any]:
    return {
        **entry,
        "skill_groups": content.get("skill_groups") or {},
        "skills": content.get("skills") or [],
        "github_skills": content.get("github_skills") or [],
        "experience_items": content.get("experience") or [],
        "project_items": content.get("projects") or [],
        "education_items": content.get("education") or [],
        "certification_items": content.get("certifications") or [],
    }


def _visible(db: Session, role_id: int):
    return (
        db.query(models.ResumeShowcase)
        .options(
            selectinload(models.ResumeShowcase.user),
            selectinload(models.ResumeShowcase.role).selectinload(models.Role.role_skills).selectinload(models.RoleSkill.skill),
        )
        .filter(models.ResumeShowcase.role_id == role_id, models.ResumeShowcase.hidden.is_(False))
    )


def ranked(db: Session, role_id: int, viewer_id: int, country: Optional[str] = None,
           seniority: Optional[str] = None) -> List[Dict[str, Any]]:
    """Every visible showcase for the role that passes the filters, best score first, with ranks."""
    showcases = _visible(db, role_id).all()
    if country:
        showcases = [s for s in showcases if shown_country(s) == country]
    if seniority:
        showcases = [s for s in showcases if s.seniority == seniority]
    interviews = interview_averages(db, role_id, [s.user_id for s in showcases])
    entries = [_entry(_card(s), interviews.get(s.user_id), viewer_id) for s in showcases]
    entries.sort(key=lambda e: (-e["score"], -e["readiness"], e["updated_at"] or ""))
    for index, entry in enumerate(entries, start=1):
        entry["rank"] = index
    return entries


def role_counts(db: Session) -> Dict[int, int]:
    rows = db.query(models.ResumeShowcase.role_id).filter(models.ResumeShowcase.hidden.is_(False)).all()
    counts: Dict[int, int] = {}
    for (role_id,) in rows:
        counts[role_id] = counts.get(role_id, 0) + 1
    return counts


def country_counts(db: Session, role_id: int) -> List[Dict[str, Any]]:
    """Countries shown on the role's visible showcases, most entries first."""
    counts: Dict[str, int] = {}
    for showcase in _visible(db, role_id).all():
        code = shown_country(showcase)
        if code:
            counts[code] = counts.get(code, 0) + 1
    listed = [{**country_payload(code), "count": n} for code, n in counts.items() if country_payload(code)]
    return sorted(listed, key=lambda c: (-c["count"], c["name"]))


def detail(db: Session, showcase: models.ResumeShowcase, viewer_id: int) -> Dict[str, Any]:
    """One showcase as other users see it, with its rank among all visible showcases for the role."""
    entries = ranked(db, showcase.role_id, viewer_id)
    entry = next((e for e in entries if e["public_id"] == showcase.public_id), None)
    if entry is None:  # hidden showcases are only ever shown to their owner
        interview = interview_averages(db, showcase.role_id, [showcase.user_id]).get(showcase.user_id)
        entry = {**_entry(_card(showcase), interview, viewer_id), "rank": None}
    return {**_with_content(entry, showcase.content or {}), "total": len(entries), "hidden": bool(showcase.hidden)}


def preview(user: models.User, resume: models.Resume, role: models.Role, github_skills: Sequence[str],
            options: Dict[str, Any], handle: str, interview: Optional[float]) -> Dict[str, Any]:
    """Exactly what other users would see, without saving anything."""
    content = build_content(user, resume, github_skills, options["show_institutions"], options["show_companies"])
    card = {
        "public_id": None,
        "user_id": user.id,
        "name": user.name if options["show_name"] and user.name else handle,
        "anonymous": not options["show_name"],
        "country": user.country if options["show_country"] else None,
        "seniority": options["seniority"],
        "role": role,
        "content": content,
        "updated_at": None,
    }
    return {**_with_content(_entry(card, interview, user.id), content), "rank": None, "total": None, "hidden": False}


def _split_skills(yours: Sequence[str], theirs: Sequence[str]) -> Dict[str, List[str]]:
    your_index = index_candidate_skills(yours)
    their_index = index_candidate_skills(theirs)
    both = [s for s in theirs if match_role_skill(s, your_index)]
    only_them = [s for s in theirs if not match_role_skill(s, your_index)]
    only_you = [s for s in yours if not match_role_skill(s, their_index)]
    return {"both": both, "only_them": only_them, "only_you": only_you}


def compare(db: Session, viewer: models.User, resume: Optional[models.Resume], showcase: models.ResumeShowcase) -> Dict[str, Any]:
    """The viewer's active resume next to a published one, measured against the published one's role."""
    role = showcase.role
    requirements = role_requirements(role)
    their = detail(db, showcase, viewer.id)
    their_skills = all_skills(showcase.content or {})

    yours: Optional[Dict[str, Any]] = None
    your_skills: List[str] = []
    if resume:
        your_skills = merge_skills(resume.extracted_skills_json or [], extra_skills(db, [viewer.id]).get(viewer.id, []))
        own = build_content(viewer, resume, [], True, True)["stats"]
        readiness = readiness_for(role, requirements, your_skills)
        interview = interview_averages(db, role.id, [viewer.id]).get(viewer.id)
        yours = {
            "readiness": readiness,
            "interview": interview,
            "score": candidate_score(readiness, interview),
            **{k: own[k] for k in ("projects", "experience", "certifications", "measurable", "completeness")},
            "skills": len(your_skills),
        }

    your_index = index_candidate_skills(your_skills)
    their_index = index_candidate_skills(their_skills)
    req_rows = [
        {
            "name": name,
            "weight": weight,
            "you": bool(match_role_skill(name, your_index)),
            "them": bool(match_role_skill(name, their_index)),
        }
        for name, weight in sorted(requirements, key=lambda r: -r[1])
    ]
    return {
        "role": {"id": role.id, "name": role.name},
        "them": {key: their[key] for key in (
            "public_id", "name", "anonymous", "country", "seniority", "readiness", "interview", "score",
            "projects", "experience", "certifications", "measurable", "completeness", "rank", "total",
        )} | {"skills": len(their_skills)},
        "you": yours,
        "has_resume": resume is not None,
        "skills": _split_skills(your_skills, their_skills),
        "requirements": req_rows,
    }


def report(db: Session, showcase: models.ResumeShowcase, reporter: models.User, reason: str) -> bool:
    """Records a report once per user; hides the showcase after REPORTS_TO_HIDE. Returns True if new."""
    reports = db.query(models.ShowcaseReport).filter(models.ShowcaseReport.showcase_id == showcase.id)
    if reports.filter(models.ShowcaseReport.reporter_id == reporter.id).first():
        return False
    db.add(models.ShowcaseReport(showcase_id=showcase.id, reporter_id=reporter.id, reason=reason))
    db.flush()
    if reports.count() >= REPORTS_TO_HIDE:
        showcase.hidden = True
    db.commit()
    return True


def remove_for_resume(db: Session, user: models.User, resume_ids: Iterable[int]) -> bool:
    """Deletes the user's showcase if it was made from one of these resumes. Does not commit."""
    showcase = user.showcase
    if showcase and showcase.resume_id in set(resume_ids):
        db.delete(showcase)
        db.flush()  # before the resume it references is deleted
        return True
    return False
