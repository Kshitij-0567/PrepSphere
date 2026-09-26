"""
The candidate's skill profile.

Resume-derived skills always come from the user's *active* resume (the one they last
uploaded or selected), so skills from old or deleted resumes never leak into skill-gap
analysis or interview questions. Skills from other sources (source != "resume") persist.
"""
from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from core import models
from .skill_taxonomy import categorize_skills, extract_skills_with_evidence, normalize_skill


def resume_skills(resume: models.Resume) -> List[str]:
    """Skills for a resume, re-extracted from its text so older uploads benefit from taxonomy fixes."""
    if resume.raw_text:
        return [s["name"] for s in extract_skills_with_evidence(resume.raw_text)]
    return [s for s in (resume.extracted_skills_json or []) if s]


def refresh_stored_skills(resume: models.Resume) -> None:
    """Rewrites the resume's stored skill lists with the current extractor's output. Does not commit."""
    if not resume.raw_text:
        return
    evidence = extract_skills_with_evidence(resume.raw_text)
    names = [s["name"] for s in evidence]
    resume.extracted_skills_json = names
    profile = dict(resume.parsed_profile_json or {})
    if profile:
        profile["skills"] = names
        profile["skills_with_evidence"] = evidence
        profile["categorized_skills"] = categorize_skills(names)
        resume.parsed_profile_json = profile


def get_active_resume(db: Session, user: models.User) -> Optional[models.Resume]:
    return (
        db.query(models.Resume)
        .filter(models.Resume.user_id == user.id, models.Resume.is_active.is_(True))
        .order_by(models.Resume.id.desc())
        .first()
    )


def candidate_skill_names(db: Session, user: models.User, resume: Optional[models.Resume] = None) -> List[str]:
    resume = resume if resume is not None else get_active_resume(db, user)
    names: List[str] = resume_skills(resume) if resume else []
    seen = {n.lower() for n in names}
    other_sources = (
        db.query(models.CandidateSkill)
        .filter(models.CandidateSkill.user_id == user.id, models.CandidateSkill.source != "resume")
        .all()
    )
    for cs in other_sources:
        if cs.skill and cs.skill.canonical_name.lower() not in seen:
            seen.add(cs.skill.canonical_name.lower())
            names.append(cs.skill.canonical_name)
    return names


def _get_or_create_skill(db: Session, name: str) -> models.Skill:
    skill = db.query(models.Skill).filter(func.lower(models.Skill.canonical_name) == name.lower()).first()
    if skill is None:
        _, category = normalize_skill(name)
        skill = models.Skill(
            name=name,
            canonical_name=name,
            category=category if category != "Other Competencies" else "Extracted",
        )
        db.add(skill)
        db.flush()
    return skill


def _replace_skills(db: Session, user: models.User, skill_names: List[str], source: str, confidence: float) -> None:
    db.query(models.CandidateSkill).filter(
        models.CandidateSkill.user_id == user.id, models.CandidateSkill.source == source
    ).delete(synchronize_session=False)

    seen = set()
    for raw in skill_names:
        name = (raw or "").strip()
        if not name or name.lower() in seen:
            continue
        seen.add(name.lower())
        skill = _get_or_create_skill(db, name)
        db.add(models.CandidateSkill(user_id=user.id, skill_id=skill.id, confidence=confidence, source=source))


def _replace_resume_skills(db: Session, user: models.User, skill_names: List[str]) -> None:
    _replace_skills(db, user, skill_names, source="resume", confidence=0.95)


def replace_github_skills(db: Session, user: models.User, skill_names: List[str]) -> None:
    """Skills demonstrated in public GitHub repositories. Does not commit."""
    _replace_skills(db, user, skill_names, source="github", confidence=0.7)


def github_skill_names(db: Session, user: models.User) -> List[str]:
    rows = (
        db.query(models.CandidateSkill)
        .filter(models.CandidateSkill.user_id == user.id, models.CandidateSkill.source == "github")
        .all()
    )
    return [r.skill.canonical_name for r in rows if r.skill]


def activate_resume(db: Session, user: models.User, resume: models.Resume) -> None:
    """Makes `resume` the active one and rebuilds the user's resume-derived skills. Commits."""
    db.query(models.Resume).filter(
        models.Resume.user_id == user.id, models.Resume.id != resume.id
    ).update({models.Resume.is_active: False}, synchronize_session=False)
    resume.is_active = True
    refresh_stored_skills(resume)
    _replace_resume_skills(db, user, resume.extracted_skills_json or [])
    db.commit()


def clear_resume_skills(db: Session, user: models.User) -> None:
    """Called when the active resume is deleted: its skills must no longer count. Does not commit."""
    _replace_resume_skills(db, user, [])
