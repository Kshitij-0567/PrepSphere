from services.skill_gap import compute_skill_gap, merge_jd_requirements, unmet_requirements

REQUIREMENTS = [
    ("Docker", 2.0),
    ("Kubernetes", 2.0),
    ("Linux Internals & Bash", 1.5),
    ("Terraform & IaC", 1.0),
]


def test_statuses_and_weighted_readiness():
    resume = "Skills: Docker, Linux, Bash, Terraform\nProject: shipped Docker images to production."
    gap = compute_skill_gap("DevOps", REQUIREMENTS, ["Docker", "Linux", "Bash", "Terraform"], resume)

    assert gap["strong_skills"] == ["Docker", "Linux Internals & Bash"]   # 2+ mentions
    assert gap["developing_skills"] == ["Terraform & IaC"]                 # mentioned once
    assert gap["missing_skills"] == ["Kubernetes"]                         # weight >= 1.5, absent
    assert gap["weak_skills"] == []
    # covered weight 2.0 + 1.5 + 1.0 = 4.5 of 6.5
    assert gap["readiness_score"] == round(4.5 / 6.5 * 100, 1)

    details = {d["name"]: d for d in gap["skill_details"]}
    assert details["Linux Internals & Bash"]["matched_via"] == ["Linux", "Bash"]


def test_low_importance_gaps_are_weak_not_missing():
    gap = compute_skill_gap("DevOps", REQUIREMENTS, ["Docker", "Kubernetes"], None)
    assert gap["missing_skills"] == ["Linux Internals & Bash"]
    assert gap["weak_skills"] == ["Terraform & IaC"]


def test_no_skills_means_zero_readiness():
    gap = compute_skill_gap("DevOps", REQUIREMENTS, [], None)
    assert gap["readiness_score"] == 0.0
    assert gap["candidate_skill_count"] == 0


def test_jd_skills_only_add_uncovered_requirements():
    merged = merge_jd_requirements(REQUIREMENTS, ["Bash", "Prometheus", "Kubernetes"])
    assert ("Prometheus", 2.0) in merged
    assert len(merged) == len(REQUIREMENTS) + 1   # Bash and Kubernetes are already covered


def test_unmet_requirements():
    assert unmet_requirements(REQUIREMENTS, ["Docker", "Bash"]) == [("Kubernetes", 2.0), ("Terraform & IaC", 1.0)]
