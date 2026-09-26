"""
Skill-gap analysis: compares a candidate's resume skills with a role's weighted requirements.

Statuses:
  strong      requirement met and backed by repeated evidence (mentioned 2+ times)
  developing  requirement met but only mentioned once (e.g. just listed under "Skills")
  missing     high-importance requirement (weight >= 1.5) with no matching resume skill
  weak        lower-importance requirement with no matching resume skill
Readiness is the share of requirement *weight* that the resume covers.
"""
from typing import Dict, List, Optional, Sequence, Tuple

from .skill_taxonomy import extract_skills_with_evidence, index_candidate_skills, match_role_skill

HIGH_IMPORTANCE = 1.5
JD_SKILL_WEIGHT = 2.0

Requirement = Tuple[str, float]


def merge_jd_requirements(requirements: Sequence[Requirement], jd_skills: Sequence[str]) -> List[Requirement]:
    """Adds JD skills as high-importance requirements unless an existing requirement already covers them."""
    merged = list(requirements)
    for jd_skill in jd_skills:
        jd_index = index_candidate_skills([jd_skill])
        if any(match_role_skill(name, jd_index) for name, _ in merged):
            continue
        merged.append((jd_skill, JD_SKILL_WEIGHT))
    return merged


def unmet_requirements(requirements: Sequence[Requirement], candidate_skills: Sequence[str]) -> List[Requirement]:
    index = index_candidate_skills(candidate_skills)
    return [(name, weight) for name, weight in requirements if not match_role_skill(name, index)]


def compute_skill_gap(
    role_name: str,
    requirements: Sequence[Requirement],
    candidate_skills: Sequence[str],
    resume_text: Optional[str] = None,
) -> Dict:
    index = index_candidate_skills(candidate_skills)
    mentions: Dict[str, int] = {}
    if resume_text:
        mentions = {s["name"]: s["mentions"] for s in extract_skills_with_evidence(resume_text)}

    buckets: Dict[str, List[str]] = {"strong": [], "developing": [], "weak": [], "missing": []}
    details = []
    total_weight = 0.0
    covered_weight = 0.0

    for name, weight in requirements:
        weight = float(weight or 1.0)
        total_weight += weight
        matched_via = match_role_skill(name, index)
        evidence_count = sum(mentions.get(skill, 1) for skill in matched_via)
        if matched_via:
            covered_weight += weight
            status = "strong" if evidence_count >= 2 else "developing"
        else:
            status = "missing" if weight >= HIGH_IMPORTANCE else "weak"
        buckets[status].append(name)
        details.append({
            "name": name,
            "status": status,
            "importance_weight": weight,
            "matched_via": matched_via,
            "mentions": evidence_count,
        })

    readiness = round(covered_weight / total_weight * 100, 1) if total_weight else 0.0
    return {
        "role_name": role_name,
        "readiness_score": readiness,
        "strong_skills": buckets["strong"],
        "developing_skills": buckets["developing"],
        "weak_skills": buckets["weak"],
        "missing_skills": buckets["missing"],
        "skill_details": details,
        "candidate_skill_count": len(candidate_skills),
    }
