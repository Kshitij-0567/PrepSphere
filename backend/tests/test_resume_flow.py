from core.config import settings
from tests.conftest import DEVOPS_RESUME, FRONTEND_RESUME, upload_text_resume


def test_upload_extracts_skills_and_activates_resume(client, user_headers):
    response = upload_text_resume(client, user_headers, DEVOPS_RESUME)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["is_active"] is True
    assert {"Docker", "Kubernetes", "Linux", "Bash", "AWS", "Terraform"} <= set(body["extracted_skills"])
    assert body["candidate_profile"]["personal_info"]["email"] == "priya.sharma@gmail.com"
    # an email domain is not a portfolio site
    assert body["candidate_profile"]["personal_info"]["portfolio"] is None

    listed = client.get("/resumes", headers=user_headers).json()
    assert len(listed) == 1 and listed[0]["is_active"] is True


def test_skill_gap_uses_only_the_active_resume(client, user_headers, roles):
    devops = roles["DevOps & Platform Engineer"]
    upload_text_resume(client, user_headers, DEVOPS_RESUME, "devops.txt")
    first_gap = client.get(f"/skill-gaps?role_id={devops['id']}", headers=user_headers).json()
    assert first_gap["has_active_resume"] is True
    assert first_gap["readiness_score"] > 60
    assert "Docker" in first_gap["strong_skills"] + first_gap["developing_skills"]

    # A second upload replaces the profile: DevOps skills from the first resume no longer count.
    upload_text_resume(client, user_headers, FRONTEND_RESUME, "frontend.txt")
    second_gap = client.get(f"/skill-gaps?role_id={devops['id']}", headers=user_headers).json()
    assert "Docker" in second_gap["missing_skills"]
    assert second_gap["readiness_score"] < first_gap["readiness_score"]

    frontend = roles["Frontend Engineer"]
    frontend_gap = client.get(f"/skill-gaps?role_id={frontend['id']}", headers=user_headers).json()
    assert "HTML/CSS" in frontend_gap["strong_skills"] + frontend_gap["developing_skills"]

    # Re-selecting the first resume brings its skills back.
    resumes = client.get("/resumes", headers=user_headers).json()
    devops_resume = next(r for r in resumes if r["filename"] == "devops.txt")
    selected = client.post(f"/resumes/{devops_resume['id']}/select", headers=user_headers)
    assert selected.status_code == 200 and selected.json()["is_active"] is True
    again = client.get(f"/skill-gaps?role_id={devops['id']}", headers=user_headers).json()
    assert again["readiness_score"] == first_gap["readiness_score"]


def test_deleting_the_active_resume_clears_its_skills(client, user_headers, roles):
    devops = roles["DevOps & Platform Engineer"]
    resume_id = upload_text_resume(client, user_headers, DEVOPS_RESUME).json()["resume_id"]
    deleted = client.delete(f"/resumes/{resume_id}", headers=user_headers)
    assert deleted.status_code == 200 and deleted.json()["was_active"] is True

    gap = client.get(f"/skill-gaps?role_id={devops['id']}", headers=user_headers).json()
    assert gap["has_active_resume"] is False
    assert gap["readiness_score"] == 0.0


def test_jd_skills_extend_the_gap(client, user_headers, roles):
    devops = roles["DevOps & Platform Engineer"]
    upload_text_resume(client, user_headers, DEVOPS_RESUME)
    gap = client.get(f"/skill-gaps?role_id={devops['id']}&jd_skills=Prometheus,Docker", headers=user_headers).json()
    assert "Prometheus" in gap["missing_skills"]
    assert [d["name"] for d in gap["skill_details"]].count("Docker") == 1


def test_custom_skill_list(client, user_headers):
    upload_text_resume(client, user_headers, DEVOPS_RESUME)
    gap = client.get("/skill-gaps?custom_skills=Docker,Rust&custom_role_name=Infra", headers=user_headers).json()
    assert gap["role_name"] == "Infra"
    assert gap["missing_skills"] == ["Rust"]
    assert gap["readiness_score"] == 50.0


def test_upload_validation(client, user_headers, monkeypatch):
    assert upload_text_resume(client, user_headers, DEVOPS_RESUME, "resume.exe").status_code == 400
    assert upload_text_resume(client, user_headers, "too short", "resume.txt").status_code == 400

    monkeypatch.setattr(settings, "max_resume_bytes", 100)
    assert upload_text_resume(client, user_headers, DEVOPS_RESUME).status_code == 413


def test_resumes_are_private(client, signup):
    _, owner = signup()
    _, other = signup()
    resume_id = upload_text_resume(client, owner, DEVOPS_RESUME).json()["resume_id"]
    assert client.get(f"/resumes/{resume_id}/profile", headers=other).status_code == 404
    assert client.post(f"/resumes/{resume_id}/select", headers=other).status_code == 404
    assert client.delete(f"/resumes/{resume_id}", headers=other).status_code == 404


def test_job_description_analysis(client, user_headers):
    jd = (
        "Senior Backend Engineer\n"
        "Requirements: 5+ years experience with Python and PostgreSQL. Must have Docker.\n"
        "Nice to have: Kubernetes."
    )
    response = client.post("/jobs/analyze", headers=user_headers, json={"jd_text": jd})
    assert response.status_code == 200
    body = response.json()
    required = {s["name"] for s in body["required_skills"]}
    preferred = {s["name"] for s in body["preferred_skills"]}
    assert {"Python", "PostgreSQL", "Docker"} <= required
    assert "Kubernetes" in preferred
    assert body["job_info"]["experience_level"] == "Senior"
    assert body["job_info"]["location"] == "Not specified"   # not invented

    assert client.post("/jobs/analyze", headers=user_headers, json={"jd_text": "too short"}).status_code == 400
