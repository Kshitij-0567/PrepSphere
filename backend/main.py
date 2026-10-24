import base64
import json
import logging
import os
import re
import secrets
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from sqlalchemy.orm import Session, selectinload

from auth import auth_utils
from core import database, models, schemas, security, seed_data
from core.config import DEMO_EMAIL_DOMAIN, QUESTIONS_PER_INTERVIEW, settings
from core.countries import COUNTRIES, country_payload, normalize_country
from core.frontend import PageLoadMiddleware
from core.migrations import run_migrations
from services import delivery as delivery_service
from services import github_service, video_interview
from services import showcase as showcase_service
from services.benchmarks import build_benchmarks, interview_averages, is_demo, suggest_country
from services.candidate_profile import (
    activate_resume, candidate_skill_names, clear_resume_skills, get_active_resume, github_skill_names,
    replace_github_skills,
)
from services.gemini_service import gemini_service
from services.interview_plan import MAX_FOLLOW_UPS, build_plan, plan_minutes
from services.profile_summary import build_profile_summary
from services.jd_intelligence import jd_intelligence_service
from services.resume_intelligence import resume_intelligence_service
from services.skill_gap import HIGH_IMPORTANCE, compute_skill_gap, merge_jd_requirements, unmet_requirements

logging.basicConfig(level=logging.INFO, format="%(levelname)s [%(name)s] %(message)s")
logger = logging.getLogger("prepsphere")

APP_VERSION = "1.4.0"
ALLOWED_RESUME_EXTENSIONS = (".pdf", ".docx", ".txt")
LINKEDIN_URL = re.compile(r"^(?:https?://)?(?:[a-z]{2,3}\.)?linkedin\.com/in/([A-Za-z0-9_%-]{3,100})/?(?:\?.*)?$", re.IGNORECASE)
LINKEDIN_HANDLE = re.compile(r"^[A-Za-z0-9_-]{3,100}$")
GITHUB_ERROR_STATUS = {"not_found": 404, "rate_limited": 429, "unavailable": 502}

_problems = settings.problems()
if _problems:
    raise RuntimeError("Unsafe configuration in backend/.env:\n- " + "\n- ".join(_problems))
if len(settings.secret_key) < 32:
    logger.warning("SECRET_KEY is shorter than 32 characters; use a longer random value in production.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handles startup and shutdown events."""
    logger.info("Starting PrepSphere %s", APP_VERSION)
    if settings.run_migrations_on_startup:
        run_migrations()
    db = database.SessionLocal()
    try:
        seed_data.seed_roles_and_skills(db)
    finally:
        db.close()
    yield
    logger.info("Shutting down")

app = FastAPI(
    title="PrepSphere — AI-Powered Interview Preparation & Skill Assessment Platform",
    description="Resume skill extraction, role skill-gap analysis, and AI mock interviews with rubric scoring.",
    version=APP_VERSION,
    lifespan=lifespan,
    # The interactive API docs are for development; production hides them (ENABLE_API_DOCS).
    docs_url="/docs" if settings.docs_enabled else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.docs_enabled else None,
    dependencies=[security.global_limit],
)

# The built React app, when this backend serves it (production builds and the Docker image).
_static_dir = settings.static_dir.resolve()
_serves_frontend = (_static_dir / "index.html").is_file()

# Added innermost first: CORS is outermost, so even 413 and 429 responses carry CORS headers
# and the frontend can show their message, and every page gets the security headers.
if _serves_frontend:
    app.add_middleware(PageLoadMiddleware, static_dir=_static_dir)
app.add_middleware(security.BodySizeLimitMiddleware, max_bytes=settings.max_request_bytes)
app.add_middleware(security.SecurityHeadersMiddleware, hsts=settings.is_production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    # Sign-in tokens travel in the Authorization header, not cookies, so no credentials are needed.
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,
)


# --- HELPERS ---

def _token_response(user: models.User) -> schemas.Token:
    token = auth_utils.create_access_token({"sub": user.email})
    return schemas.Token(
        access_token=token,
        token_type="bearer",
        user_name=user.name,
        user_email=user.email,
        user={"id": user.id, "name": user.name, "email": user.email},
    )


def _role_requirements(role: Optional[models.Role]) -> List[tuple]:
    if role is None:
        return []
    return [(rs.skill.canonical_name, rs.importance_weight or 1.0) for rs in role.role_skills if rs.skill]


def _role_schema(role: models.Role) -> schemas.RoleSchema:
    ordered = sorted(role.role_skills, key=lambda rs: -(rs.importance_weight or 1.0))
    return schemas.RoleSchema(
        id=role.id,
        name=role.name,
        category=role.category or "Software & Systems",
        description=role.description,
        required_skills=[rs.skill for rs in ordered if rs.skill],
    )


def _interview_difficulty(seniority: str, company: Optional[models.Company]) -> str:
    """Seniority sets the baseline; a company's known interview rigor nudges it up or down."""
    level = {"Junior": 0, "Mid": 1, "Senior": 2}.get(seniority or "Mid", 1)
    if company is not None:
        level += {"Easy": -1, "Medium": 0, "Hard": 1}.get(company.difficulty_level or "Medium", 0)
    return ("Easy", "Medium", "Hard")[max(0, min(2, level))]


def _country_param(value: Optional[str]) -> Optional[str]:
    """An ISO country code from a request; empty means none."""
    if not (value or "").strip():
        return None
    code = normalize_country(value)
    if not code:
        raise HTTPException(status_code=400, detail="Choose a country from the list.")
    return code


def _chosen_role(db: Session, user: models.User, role_id: Optional[int]) -> models.Role:
    """The requested role, else the role of the user's latest interview, else the first role."""
    if role_id is not None:
        role = db.get(models.Role, role_id)
        if not role:
            raise HTTPException(status_code=404, detail="Role not found")
        return role
    latest = _latest_role_interview(db, user)
    if latest:
        return latest.role
    role = db.query(models.Role).order_by(models.Role.id).first()
    if not role:
        raise HTTPException(status_code=404, detail="No roles are available")
    return role


def _latest_role_interview(db: Session, user: models.User) -> Optional[models.Interview]:
    return (
        db.query(models.Interview)
        .filter(models.Interview.user_id == user.id, models.Interview.role_id.isnot(None))
        .order_by(models.Interview.started_at.desc(), models.Interview.id.desc())
        .first()
    )


def _resume_summary(resume: Optional[models.Resume]) -> str:
    return resume.raw_text[:1500] if resume and resume.raw_text else ""


def _split_csv(value: Optional[str], limit: int = 30) -> List[str]:
    items: List[str] = []
    for part in (value or "").split(","):
        item = part.strip()[:100]
        if item and item.lower() not in {i.lower() for i in items}:
            items.append(item)
    return items[:limit]


def _get_owned_resume(db: Session, resume_id: int, user: models.User) -> models.Resume:
    resume = db.query(models.Resume).filter(models.Resume.id == resume_id, models.Resume.user_id == user.id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Saved resume not found")
    return resume


def _get_owned_interview(db: Session, interview_id: int, user: models.User) -> models.Interview:
    interview = db.query(models.Interview).filter(
        models.Interview.id == interview_id, models.Interview.user_id == user.id
    ).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    return interview


def _generation_context(db: Session, interview: models.Interview, user: models.User) -> Dict[str, Any]:
    """Inputs for question generation, derived from the interview and the candidate's active resume."""
    role = interview.role
    company = interview.company
    seniority = interview.seniority or "Mid"
    requirements = merge_jd_requirements(_role_requirements(role), interview.jd_skills or [])
    resume = get_active_resume(db, user)
    candidate_skills = candidate_skill_names(db, user, resume)
    return {
        "role_name": role.name if role else "General Role",
        "target_skills": [name for name, _ in requirements],
        "candidate_skills": candidate_skills,
        "weak_skills": [name for name, _ in unmet_requirements(requirements, candidate_skills)],
        "seniority": seniority,
        "difficulty": _interview_difficulty(seniority, company),
        "company_name": company.name if company else None,
        "company_focus": company.interview_focus if company else None,
        "company_topics": company.common_topics if company else None,
        "company_what_wants": company.what_company_wants if company else None,
        "resume_summary": _resume_summary(resume),
        "job_description": interview.job_description or "",
    }


def _previous_context(answers: List[models.Answer]) -> List[Dict[str, Any]]:
    """Earlier questions and answers, so the next question builds on the conversation."""
    return [
        {
            "question": a.question.question_text,
            "answer_summary": (a.answer_text or "")[:250],
            "missing": (a.rubric_json or {}).get("missing_concepts", []),
        }
        for a in answers
        if a.question
    ]


def _profile_response(resume: models.Resume, profile: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "resume_id": resume.id,
        "filename": resume.filename,
        "is_active": bool(resume.is_active),
        "extracted_skills": resume.extracted_skills_json or profile.get("skills", []),
        "candidate_profile": profile,
        "quality_analysis": resume.quality_analysis_json or profile.get("quality_analysis", {}),
    }


async def _ensure_profile(db: Session, resume: models.Resume) -> Dict[str, Any]:
    """Older resumes may predate structured parsing; analyze them on first use."""
    profile = resume.parsed_profile_json or {}
    if not profile and resume.raw_text:
        profile = await resume_intelligence_service.analyze_resume(resume.raw_text, resume.filename or "resume.pdf")
        resume.parsed_profile_json = profile
        resume.quality_analysis_json = profile.get("quality_analysis", {})
        resume.extracted_skills_json = profile.get("skills", [])
        db.commit()
    return profile


@app.get("/health")
async def health():
    return {"status": "ok", "app": "PrepSphere", "version": APP_VERSION, "ai_enabled": gemini_service.available}

# --- AUTH ENDPOINTS (SRS FR-01 & Section 11) ---

@app.post("/auth/register", response_model=schemas.Token, dependencies=[security.per_ip("signup", 30, 600)])
@app.post("/auth/signup", response_model=schemas.Token, dependencies=[security.per_ip("signup", 30, 600)])
async def register(user_data: schemas.UserRegister, db: Session = Depends(database.get_db)):
    if auth_utils.get_user_by_email(db, user_data.email):
        raise HTTPException(status_code=400, detail="Email is already registered")

    hashed_pw = await run_in_threadpool(auth_utils.get_password_hash, user_data.password)
    user = models.User(name=user_data.get_display_name(), email=user_data.email, password_hash=hashed_pw)
    db.add(user)
    db.commit()
    db.refresh(user)
    return _token_response(user)

@app.post("/auth/login", response_model=schemas.Token, dependencies=[security.per_ip("login", 20, 60)])
async def login(login_data: schemas.UserLogin, db: Session = Depends(database.get_db)):
    security.login_blocked(login_data.email)
    user = auth_utils.get_user_by_email(db, login_data.email)
    # Always checks a password, even for an unknown email, so timing does not reveal which emails exist.
    valid = await run_in_threadpool(
        auth_utils.verify_password, login_data.password, user.password_hash if user else None
    )
    if not valid or user is None:
        security.record_failed_login(login_data.email)
        raise HTTPException(status_code=400, detail="Invalid email or password")
    security.clear_failed_logins(login_data.email)
    return _token_response(user)

@app.post("/auth/google", response_model=schemas.Token, dependencies=[security.per_ip("google", 30, 60)])
async def google_login(data: schemas.GoogleLoginRequest, db: Session = Depends(database.get_db)):
    if not settings.google_client_id:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured on this server")
    try:
        # The audience check ensures the token was issued for this app, not any Google client.
        idinfo = await run_in_threadpool(
            id_token.verify_oauth2_token, data.token, google_requests.Request(), settings.google_client_id
        )
    except ValueError as exc:
        logger.info("Rejected Google token: %s", exc)
        raise HTTPException(status_code=401, detail="Google sign-in failed: the token is invalid or expired")

    email = (idinfo.get("email") or "").strip().lower()
    if not email or not idinfo.get("email_verified"):
        raise HTTPException(status_code=401, detail="Your Google account email address is not verified")

    user = auth_utils.get_user_by_email(db, email)
    if not user:
        name = schemas.clean_display_name(idinfo.get("name") or "") or email.split("@")[0]
        user = models.User(email=email, name=name, password_hash=None)
        db.add(user)
        db.commit()
        db.refresh(user)
    return _token_response(user)

@app.post("/auth/demo", response_model=schemas.Token, dependencies=[security.per_ip("demo", 10, 600)])
async def demo_login(db: Session = Depends(database.get_db)):
    """Creates a fresh, private demo account so demo visitors never see each other's data."""
    if not settings.demo_login_enabled:
        raise HTTPException(status_code=404, detail="Demo login is disabled")
    user = models.User(
        name="Demo Candidate",
        email=f"demo-{secrets.token_hex(8)}@{DEMO_EMAIL_DOMAIN}",
        password_hash=None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _token_response(user)

@app.get("/users/me", response_model=schemas.UserProfile)
async def get_me(current_user: models.User = Depends(auth_utils.get_current_user)):
    return current_user

@app.patch("/users/me", response_model=schemas.UserProfile)
async def update_me(
    data: schemas.UserUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    if "name" in data.model_fields_set:
        current_user.name = data.name
    if "country" in data.model_fields_set:
        current_user.country = _country_param(data.country)
    db.commit()
    db.refresh(current_user)
    return current_user

@app.get("/countries")
async def list_countries():
    return [{"code": code, "name": name} for code, name in sorted(COUNTRIES.items(), key=lambda item: item[1])]

@app.get("/users/stats", response_model=schemas.UserStats)
async def get_user_stats(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    interviews = db.query(models.Interview).filter(models.Interview.user_id == current_user.id).all()
    completed = [i for i in interviews if i.status == "completed"]
    scores = [i.overall_score for i in completed if i.overall_score is not None]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0
    return schemas.UserStats(
        total_interviews=len(interviews),
        completed_interviews=len(completed),
        in_progress_interviews=len(interviews) - len(completed),
        avg_score=avg_score,
    )

# --- PROFILE PAGE ---

def _links_payload(user: models.User) -> Dict[str, Any]:
    return {
        "linkedin": user.linkedin_handle,
        "linkedin_url": f"https://www.linkedin.com/in/{user.linkedin_handle}" if user.linkedin_handle else None,
        "github": user.github_username,
        "github_url": f"https://github.com/{user.github_username}" if user.github_username else None,
    }


def _parse_linkedin(value: str) -> Optional[str]:
    text = value.strip()
    match = LINKEDIN_URL.match(text)
    if match:
        return match.group(1)
    return text if LINKEDIN_HANDLE.match(text) else None


def _clear_github(db: Session, user: models.User) -> None:
    user.github_username = None
    user.github_data = None
    user.github_synced_at = None
    replace_github_skills(db, user, [])


def _store_github(db: Session, user: models.User, data: Dict[str, Any], username: str) -> None:
    user.github_username = data.get("username") or username
    user.github_data = data
    user.github_synced_at = models.utcnow()
    replace_github_skills(db, user, [s["name"] for s in data.get("skills", [])])


@app.get("/profile/summary")
async def get_profile_summary(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    return build_profile_summary(db, current_user)

@app.put("/profile/links", dependencies=[security.per_user("github", 10, 600)])
async def update_profile_links(
    data: schemas.ProfileLinksUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    """Saves LinkedIn/GitHub links. A new GitHub username is imported straight away."""
    warning = None
    if "linkedin" in data.model_fields_set:
        if not (data.linkedin or "").strip():
            current_user.linkedin_handle = None
        else:
            handle = _parse_linkedin(data.linkedin)
            if not handle:
                raise HTTPException(status_code=400, detail="Enter a LinkedIn profile URL, for example linkedin.com/in/your-name.")
            current_user.linkedin_handle = handle

    if "github" in data.model_fields_set:
        if not (data.github or "").strip():
            _clear_github(db, current_user)
        else:
            username = github_service.parse_username(data.github)
            if not username:
                raise HTTPException(status_code=400, detail="Enter a GitHub username or profile URL, for example github.com/your-name.")
            changed = username.lower() != (current_user.github_username or "").lower()
            if changed or not current_user.github_data:
                try:
                    github_data = await github_service.fetch_github_profile(username)
                except github_service.GitHubError as exc:
                    if exc.code == "not_found":
                        raise HTTPException(status_code=400, detail=exc.message)
                    # Keep the link; the import can be retried with "Sync" later.
                    warning = f"Saved your GitHub link, but the import did not finish. {exc.message}"
                    if changed:
                        _clear_github(db, current_user)
                    current_user.github_username = username
                else:
                    _store_github(db, current_user, github_data, username)

    db.commit()
    db.refresh(current_user)
    return {"links": _links_payload(current_user), "github": current_user.github_data, "warning": warning}

@app.post("/profile/github/sync", dependencies=[security.per_user("github", 10, 600)])
async def sync_github(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    if not current_user.github_username:
        raise HTTPException(status_code=400, detail="Add your GitHub profile first.")
    try:
        github_data = await github_service.fetch_github_profile(current_user.github_username)
    except github_service.GitHubError as exc:
        raise HTTPException(status_code=GITHUB_ERROR_STATUS.get(exc.code, 502), detail=exc.message)
    _store_github(db, current_user, github_data, current_user.github_username)
    db.commit()
    return {"links": _links_payload(current_user), "github": current_user.github_data}

# --- TARGET ROLES ENDPOINTS (SRS FR-03 & Section 11) ---

@app.get("/roles", response_model=list[schemas.RoleSchema])
async def get_roles(db: Session = Depends(database.get_db)):
    roles = (
        db.query(models.Role)
        .options(selectinload(models.Role.role_skills).selectinload(models.RoleSkill.skill))
        .order_by(models.Role.id)
        .all()
    )
    return [_role_schema(r) for r in roles]

@app.get("/roles/{role_id}", response_model=schemas.RoleSchema)
async def get_role(role_id: int, db: Session = Depends(database.get_db)):
    role = db.get(models.Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return _role_schema(role)

# --- RESUME & SKILL EXTRACTION ENDPOINTS (SRS FR-04, FR-05, FR-06, FR-07) ---

@app.get("/roles/{role_id}/video-plan")
async def get_video_plan(role_id: int, seniority: schemas.Seniority = "Mid", db: Session = Depends(database.get_db)):
    """The steps a video interview for this role and seniority would have, shown before it starts."""
    role = db.get(models.Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    plan = build_plan(role.category, seniority)
    return {"plan": plan, "minutes": plan_minutes(plan)}

@app.post("/resumes/upload", dependencies=[security.per_user("resume-upload", 10, 600)])
async def upload_resume(
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    filename = Path(file.filename or "").name[:255]
    if not filename.lower().endswith(ALLOWED_RESUME_EXTENSIONS):
        raise HTTPException(status_code=400, detail="Only PDF, DOCX, or TXT resumes are supported")

    file_bytes = await file.read(settings.max_resume_bytes + 1)
    if len(file_bytes) > settings.max_resume_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Resume files must be {settings.max_resume_bytes // (1024 * 1024)} MB or smaller",
        )
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded resume file is empty")

    try:
        raw_text = resume_intelligence_service.extract_text(file_bytes, filename)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

    # Full structured resume intelligence analysis (runs before any database writes)
    analysis = await resume_intelligence_service.analyze_resume(raw_text, filename)

    resume = models.Resume(
        user_id=current_user.id,
        file_path=filename,
        filename=filename,
        raw_text=raw_text,
        extracted_skills_json=analysis.get("skills", []),
        parsed_profile_json=analysis,
        quality_analysis_json=analysis.get("quality_analysis", {}),
        status="parsed"
    )
    db.add(resume)
    db.flush()
    detected_name = schemas.clean_display_name(analysis.get("personal_info", {}).get("name") or "")
    if detected_name and not current_user.name:
        current_user.name = detected_name
    activate_resume(db, current_user, resume)
    db.refresh(resume)

    return {**_profile_response(resume, resume.parsed_profile_json or analysis), "status": "parsed"}

@app.get("/resumes")
async def list_saved_resumes(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    resumes = db.query(models.Resume).filter(models.Resume.user_id == current_user.id).order_by(models.Resume.uploaded_at.desc()).all()
    res_list = []
    for r in resumes:
        quality = r.quality_analysis_json if isinstance(r.quality_analysis_json, dict) else {}
        res_list.append({
            "id": r.id,
            "filename": r.filename or r.file_path or f"Resume #{r.id}",
            "uploaded_at": r.uploaded_at.isoformat() if r.uploaded_at else "",
            "status": r.status or "parsed",
            "is_active": bool(r.is_active),
            "extracted_skills": r.extracted_skills_json or [],
            "quality_score": quality.get("completeness_score"),
            "candidate_profile": r.parsed_profile_json or {}
        })
    return res_list

@app.get("/resumes/{resume_id}/profile")
async def get_resume_profile(
    resume_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    resume = _get_owned_resume(db, resume_id, current_user)
    profile = await _ensure_profile(db, resume)
    return _profile_response(resume, profile)

@app.post("/resumes/{resume_id}/select")
async def select_saved_resume(
    resume_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    resume = _get_owned_resume(db, resume_id, current_user)
    await _ensure_profile(db, resume)
    activate_resume(db, current_user, resume)
    db.refresh(resume)
    return _profile_response(resume, resume.parsed_profile_json or {})

@app.delete("/resumes/{resume_id}")
async def delete_saved_resume(
    resume_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    resume = _get_owned_resume(db, resume_id, current_user)
    was_active = bool(resume.is_active)
    # A published copy of this resume goes with it.
    showcase_removed = showcase_service.remove_for_resume(db, current_user, [resume.id])
    db.delete(resume)
    if was_active:
        clear_resume_skills(db, current_user)
    db.commit()
    return {"message": "Resume deleted successfully", "was_active": was_active, "showcase_removed": showcase_removed}

@app.get("/profiles/me")
async def get_candidate_profile(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    resume = get_active_resume(db, current_user)
    return {
        "user_id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "extracted_skills": candidate_skill_names(db, current_user, resume),
        "active_resume_id": resume.id if resume else None,
        "candidate_profile": resume.parsed_profile_json if resume else {},
        "quality_analysis": resume.quality_analysis_json if resume else {},
        "resume_status": resume.status if resume else "none"
    }

# --- JOB DESCRIPTION INTELLIGENCE ENDPOINTS ---

@app.post("/jobs/analyze", response_model=schemas.JobAnalysisResponse, dependencies=[security.per_user("jd-analyze", 20, 600)])
async def analyze_job_description(
    req: schemas.JobAnalysisRequest,
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    try:
        return await jd_intelligence_service.analyze_job_description(req.jd_text, req.role_title)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

# --- SKILL GAP ENDPOINT (SRS FR-08 & Section 10.3) ---

@app.get("/skill-gaps", response_model=schemas.SkillGapResponse)
async def get_skill_gaps(
    role_id: Optional[int] = None,
    custom_skills: Optional[str] = None,
    custom_role_name: Optional[str] = None,
    jd_skills: Optional[str] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    """Compares the active resume with a catalog role (optionally plus JD skills) or a custom skill list."""
    resume = get_active_resume(db, current_user)
    candidate_skills = candidate_skill_names(db, current_user, resume)

    if custom_skills:
        requirements = [(skill, 2.0) for skill in _split_csv(custom_skills)]
        role_name = (custom_role_name or "Custom Target Role")[:200]
    else:
        if not role_id:
            raise HTTPException(status_code=400, detail="Either role_id or custom_skills must be provided")
        role = db.get(models.Role, role_id)
        if not role:
            raise HTTPException(status_code=404, detail="Role not found")
        requirements = merge_jd_requirements(_role_requirements(role), _split_csv(jd_skills))
        role_name = role.name

    gap = compute_skill_gap(role_name, requirements, candidate_skills, resume.raw_text if resume else None)
    return schemas.SkillGapResponse(**gap, has_active_resume=resume is not None)


# --- BENCHMARKS & RESUME SHOWCASE ---

@app.get("/benchmarks", dependencies=[security.per_user("benchmarks", 60, 60)])
async def get_benchmarks(
    role_id: Optional[int] = None,
    country: Optional[str] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    """How the user compares with everyone preparing for a role, worldwide or in one country."""
    role = _chosen_role(db, current_user, role_id)
    return build_benchmarks(db, current_user, role, _country_param(country))


def _publish_inputs(db: Session, user: models.User, data: schemas.ShowcaseOptions):
    if is_demo(user):
        raise HTTPException(status_code=403, detail="Demo accounts cannot publish a resume. Create a free account to use the showcase.")
    resume = get_active_resume(db, user)
    if not resume or resume.status != "parsed":
        raise HTTPException(status_code=400, detail="Upload a resume first. The showcase publishes your active resume.")
    role = _chosen_role(db, user, data.role_id)
    options = data.model_dump(include={"seniority", "show_name", "show_country", "show_institutions", "show_companies"})
    return resume, role, options


def _get_showcase(db: Session, public_id: str, user: models.User) -> models.ResumeShowcase:
    showcase = db.query(models.ResumeShowcase).filter(models.ResumeShowcase.public_id == public_id).first()
    if not showcase or (showcase.hidden and showcase.user_id != user.id):
        raise HTTPException(status_code=404, detail="This resume is not in the showcase any more.")
    return showcase


@app.get("/showcase/me")
async def get_my_showcase(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    """The user's published resume (if any), and what the publish form starts from."""
    resume = get_active_resume(db, current_user)
    showcase = current_user.showcase
    if showcase:
        options = {**(showcase.options or {}), "role_id": showcase.role_id, "seniority": showcase.seniority, "show_name": showcase.show_name}
    else:
        latest = _latest_role_interview(db, current_user)
        options = {
            "role_id": _chosen_role(db, current_user, None).id,
            "seniority": (latest.seniority if latest else None) or "Mid",
            "show_name": False, "show_country": True, "show_institutions": False, "show_companies": False,
        }
    blocked = "demo" if is_demo(current_user) else "no_resume" if not resume else None
    return {
        "showcase": showcase_service.detail(db, showcase, current_user.id) if showcase else None,
        "options": options,
        "handle": showcase.handle if showcase else showcase_service.handle_for(current_user.id),
        "blocked_reason": blocked,
        "active_resume": {"id": resume.id, "filename": resume.filename or f"Resume #{resume.id}"} if resume else None,
        "outdated": bool(showcase and resume and showcase.resume_id != resume.id),
        "country": country_payload(current_user.country),
        "suggested_country": None if current_user.country else country_payload(suggest_country(resume)),
    }

@app.post("/showcase/preview", dependencies=[security.per_user("showcase-preview", 120, 600)])
async def preview_showcase(
    data: schemas.ShowcaseOptions,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    """Exactly what other users would see if the active resume were published with these options."""
    resume, role, options = _publish_inputs(db, current_user, data)
    handle = current_user.showcase.handle if current_user.showcase else showcase_service.handle_for(current_user.id)
    interview = interview_averages(db, role.id, [current_user.id]).get(current_user.id)
    return showcase_service.preview(current_user, resume, role, github_skill_names(db, current_user), options, handle, interview)

@app.put("/showcase", dependencies=[security.per_user("showcase-publish", 20, 3600)])
async def publish_showcase(
    data: schemas.ShowcasePublish,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    """Publishes the active resume, or replaces the published copy with a fresh one."""
    if not data.confirm:
        raise HTTPException(status_code=400, detail="Review the preview and confirm before publishing.")
    resume, role, options = _publish_inputs(db, current_user, data)
    content = showcase_service.build_content(
        current_user, resume, github_skill_names(db, current_user), options["show_institutions"], options["show_companies"]
    )
    now = models.utcnow()
    showcase = current_user.showcase
    if showcase is None:
        showcase = models.ResumeShowcase(
            public_id=showcase_service.new_public_id(db),
            user_id=current_user.id,
            handle=showcase_service.handle_for(current_user.id),
            published_at=now,
        )
        db.add(showcase)
    elif showcase.content != content or showcase.show_name != options["show_name"]:
        # Reports were about the old copy; a changed copy starts clean. Republishing the same
        # copy keeps the reports, so a hidden resume cannot simply be put back.
        for old in list(showcase.reports):
            db.delete(old)
        showcase.hidden = False
    showcase.resume_id = resume.id
    showcase.role_id = role.id
    showcase.seniority = options["seniority"]
    showcase.show_name = options["show_name"]
    showcase.options = {k: options[k] for k in ("show_country", "show_institutions", "show_companies")}
    showcase.content = content
    showcase.updated_at = now
    db.commit()
    db.refresh(showcase)
    return showcase_service.detail(db, showcase, current_user.id)

@app.delete("/showcase")
async def unpublish_showcase(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    """Removes the published copy completely, together with any reports about it."""
    showcase = current_user.showcase
    if not showcase:
        raise HTTPException(status_code=404, detail="You have not published a resume.")
    db.delete(showcase)
    db.commit()
    return {"removed": True}

@app.get("/showcase")
async def list_showcase(
    role_id: Optional[int] = None,
    country: Optional[str] = None,
    seniority: Optional[schemas.Seniority] = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    """Published resumes for a role, ranked by candidate score, optionally for one country and level."""
    role = _chosen_role(db, current_user, role_id)
    code = _country_param(country)
    entries = showcase_service.ranked(db, role.id, current_user.id, code, seniority)
    return {
        "role": {"id": role.id, "name": role.name},
        "country": country_payload(code),
        "seniority": seniority,
        "total": len(entries),
        "entries": entries[offset:offset + limit],
        "you": next((e for e in entries if e["is_you"]), None),
        "role_counts": showcase_service.role_counts(db),
        "countries": showcase_service.country_counts(db, role.id),
    }

@app.get("/showcase/{public_id}")
async def get_showcase(
    public_id: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    return showcase_service.detail(db, _get_showcase(db, public_id, current_user), current_user.id)

@app.get("/showcase/{public_id}/compare")
async def compare_showcase(
    public_id: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    """The user's active resume next to a published one, for the published one's role."""
    showcase = _get_showcase(db, public_id, current_user)
    return showcase_service.compare(db, current_user, get_active_resume(db, current_user), showcase)

@app.post("/showcase/{public_id}/report", dependencies=[security.per_user("showcase-report", 20, 86400)])
async def report_showcase(
    public_id: str,
    data: schemas.ShowcaseReportCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    showcase = _get_showcase(db, public_id, current_user)
    if showcase.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot report your own resume. Update or remove it instead.")
    if is_demo(current_user):
        raise HTTPException(status_code=403, detail="Demo accounts cannot report resumes. Create a free account to report one.")
    created = showcase_service.report(db, showcase, current_user, data.reason)
    return {"reported": True, "already_reported": not created}


# --- COMPANY ENDPOINTS ---

@app.get("/companies", response_model=list[schemas.CompanySchema])
async def list_companies(
    search: Optional[str] = None,
    tier: Optional[str] = None,
    db: Session = Depends(database.get_db)
):
    query = db.query(models.Company)
    if search:
        query = query.filter(models.Company.name.ilike(f"%{search.strip()[:100]}%"))
    if tier and tier != "All":
        query = query.filter(models.Company.tier == tier)
    return query.order_by(models.Company.name).all()

@app.get("/companies/{company_id}", response_model=schemas.CompanySchema)
async def get_company(company_id: int, db: Session = Depends(database.get_db)):
    company = db.get(models.Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company

# --- MOCK INTERVIEW ENDPOINTS (SRS FR-09 to FR-14) ---

# Browsers send each spoken answer as 16 kHz WAV; other formats Gemini can read are accepted too.
# WebM and MP4 recordings go to Gemini's video decoder, which also reads audio-only files.
ANSWER_AUDIO_TYPES = {
    "audio/wav": "audio/wav", "audio/x-wav": "audio/wav", "audio/wave": "audio/wav", "audio/mp3": "audio/mp3",
    "audio/mpeg": "audio/mp3", "audio/aac": "audio/aac", "audio/ogg": "audio/ogg", "audio/flac": "audio/flac",
    "audio/webm": "video/webm", "video/webm": "video/webm", "audio/mp4": "video/mp4",
}
MAX_DIAGRAM_BYTES = 4 * 1024 * 1024
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def _is_video(interview: models.Interview) -> bool:
    return (interview.mode or "text") == "video"


def _total_questions(interview: models.Interview) -> int:
    """Questions in a text interview; steps in a video interview."""
    return len(interview.plan or []) if _is_video(interview) else QUESTIONS_PER_INTERVIEW


def _sorted_answers(interview: models.Interview) -> List[models.Answer]:
    return sorted(interview.answers, key=lambda a: a.id)


def _step_scores(items) -> Dict[int, float]:
    """Average score per plan step from (step_index, score) pairs; a follow-up shares its step."""
    by_step: Dict[int, List[float]] = {}
    for step_index, score in items:
        if step_index is not None and score is not None:
            by_step.setdefault(step_index, []).append(score)
    return {i: round(sum(v) / len(v), 1) for i, v in sorted(by_step.items())}


def _answer_pairs(answers: List[models.Answer]) -> List[tuple]:
    return [(a.question.step_index if a.question else None, a.score) for a in answers]


def _overall_score(interview: models.Interview, pairs: List[tuple]) -> Optional[float]:
    if _is_video(interview):
        scores = list(_step_scores(pairs).values())
    else:
        scores = [score for _, score in pairs if score is not None]
    return round(sum(scores) / len(scores), 1) if scores else None


def _video_context(db: Session, interview: models.Interview, user: models.User) -> Dict[str, Any]:
    context = _generation_context(db, interview, user)
    context["role_category"] = interview.role.category if interview.role else None
    name = (user.name or "").strip()
    context["candidate_name"] = name.split()[0] if name else None
    return context


def _video_history(answers: List[models.Answer]) -> List[Dict[str, Any]]:
    return [
        {"question": a.question.question_text, "answer_summary": (a.answer_text or a.code or "")[:250]}
        for a in answers if a.question
    ]


async def _completion_recommendations(
    db: Session, interview: models.Interview, user: models.User, rubrics: List[Dict[str, Any]],
    deliveries: List[Optional[Dict[str, Any]]],
) -> List[Dict[str, Any]]:
    """Study-plan items for a finished interview: missing role skills, missed concepts, delivery habits."""
    if not rubrics:
        return []
    weak_topics: List[str] = []
    for rubric in rubrics:
        for concept in rubric.get("missing_concepts", []):
            if concept not in weak_topics:
                weak_topics.append(concept)
    context = _generation_context(db, interview, user)
    requirements = merge_jd_requirements(_role_requirements(interview.role), interview.jd_skills or [])
    missing_skills = [
        name for name, weight in unmet_requirements(requirements, context["candidate_skills"])
        if weight >= HIGH_IMPORTANCE
    ]
    recs = await gemini_service.generate_recommendations(
        missing_skills=missing_skills[:5], weak_topics=weak_topics[:8], role_name=context["role_name"]
    )
    if _is_video(interview):
        recs = recs[:4] + delivery_service.delivery_tips(delivery_service.summarize(deliveries))[:2]
    return recs


def _mark_completed(db: Session, interview: models.Interview, user: models.User,
                    overall: Optional[float], recs: List[Dict[str, Any]]) -> None:
    interview.status = "completed"
    interview.overall_score = overall
    interview.completed_at = models.utcnow()
    for r in recs:
        db.add(models.Recommendation(
            user_id=user.id, interview_id=interview.id, topic=r["topic"], priority=r["priority"], reason=r["reason"],
        ))


def _new_question(interview: models.Interview, q_data: Dict[str, Any], **extra) -> models.Question:
    return models.Question(
        interview_id=interview.id,
        question_text=q_data["question_text"],
        difficulty=q_data.get("difficulty", "Medium"),
        expected_concepts=q_data.get("expected_concepts", []),
        **extra,
    )


async def _step_question(db: Session, interview: models.Interview, user: models.User, step_index: int,
                         history: List[Dict[str, Any]]) -> models.Question:
    step = interview.plan[step_index]
    q_data = await video_interview.generate_step_question(
        step, _video_context(db, interview, user), history, seed=(interview.id or 0) + step_index,
    )
    return _new_question(interview, q_data, kind=step["kind"], step_index=step_index, details=q_data.get("details"))


@app.post("/interviews", dependencies=[security.per_user("interview-start", 20, 3600)])
async def create_interview(
    data: schemas.InterviewCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    role = db.get(models.Role, data.role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Selected target role not found")

    company = None
    if data.company_id is not None:
        company = db.get(models.Company, data.company_id)
        if not company:
            raise HTTPException(status_code=404, detail="Selected company not found")

    jd_text = (data.job_description or "").strip()
    jd_skills: List[str] = []
    if jd_text:
        try:
            jd_analysis = await jd_intelligence_service.analyze_job_description(jd_text, role.name)
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))
        jd_skills = [s["name"] for s in jd_analysis["required_skills"]][:15]

    interview = models.Interview(
        user_id=current_user.id,
        role_id=role.id,
        company_id=company.id if company else None,
        status="in_progress",
        seniority=data.seniority,
        job_description=jd_text or None,
        jd_skills=jd_skills,
        mode=data.mode,
        plan=build_plan(role.category, data.seniority) if data.mode == "video" else None,
    )
    interview.role = role
    interview.company = company

    # Generate the first question before writing anything, so no database lock is held
    # while waiting on the AI model.
    if interview.plan:
        step = interview.plan[0]
        q_data = await video_interview.generate_step_question(
            step, _video_context(db, interview, current_user), [], seed=secrets.randbelow(1000),
        )
        extra = {"kind": step["kind"], "step_index": 0, "details": q_data.get("details")}
    else:
        q_data = await gemini_service.generate_question(
            **_generation_context(db, interview, current_user),
            question_number=1,
            previous_qa_context=[],
        )
        extra = {}

    db.add(interview)
    db.flush()
    question = _new_question(interview, q_data, **extra)
    db.add(question)
    db.commit()
    db.refresh(question)

    return {
        "interview_id": interview.id,
        "mode": interview.mode,
        "plan": interview.plan,
        "question": schemas.QuestionResponse.model_validate(question),
        "total_questions": _total_questions(interview),
        "jd_skills": jd_skills,
    }

@app.get("/interviews/history")
async def get_interview_history(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    interviews = db.query(models.Interview).filter(models.Interview.user_id == current_user.id).order_by(models.Interview.started_at.desc(), models.Interview.id.desc()).all()
    history = []
    for i in interviews:
        answers = _sorted_answers(i)
        if _is_video(i):
            step_scores = _step_scores(_answer_pairs(answers))
            answered, scores = len(step_scores), list(step_scores.values())
        else:
            answered, scores = len(answers), [a.score for a in answers]
        history.append({
            "id": i.id,
            "mode": i.mode or "text",
            "role_id": i.role_id,
            "role_name": i.role.name if i.role else "Target Role",
            "company_id": i.company_id,
            "company_name": i.company.name if i.company else None,
            "seniority": i.seniority,
            "status": i.status,
            "overall_score": i.overall_score,
            "questions_answered": answered,
            "total_questions": _total_questions(i),
            "scores": scores,
            "started_at": i.started_at,
            "completed_at": i.completed_at,
        })
    return history

@app.post("/interviews/{interview_id}/resume", dependencies=[security.per_user("interview-resume", 30, 600)])
async def resume_interview(
    interview_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    """Everything needed to continue an unfinished interview where the candidate left off.
    Interviews interrupted before their next question was saved get that question now."""
    interview = _get_owned_interview(db, interview_id, current_user)
    if interview.status == "completed":
        raise HTTPException(status_code=409, detail="This interview is already completed. Open its results instead.")
    answered_ids = {a.question_id for a in interview.answers}
    questions = sorted(interview.questions, key=lambda q: q.id)
    current = next((q for q in questions if q.id not in answered_ids), None)
    answers = _sorted_answers(interview)
    if current is None:
        if _is_video(interview):
            next_index = max((q.step_index for q in questions if q.step_index is not None), default=-1) + 1
            if next_index >= len(interview.plan or []):
                # Every step was answered but the interview was never closed; close it now.
                recs = await _completion_recommendations(
                    db, interview, current_user, [a.rubric_json or {} for a in answers], [a.delivery for a in answers],
                )
                _mark_completed(db, interview, current_user, _overall_score(interview, _answer_pairs(answers)), recs)
                db.commit()
                raise HTTPException(status_code=409, detail="This interview is already completed. Open its results instead.")
            current = await _step_question(db, interview, current_user, next_index, _video_history(answers))
        else:
            q_data = await gemini_service.generate_question(
                **_generation_context(db, interview, current_user),
                question_number=len(answers) + 1,
                previous_qa_context=_previous_context(answers),
            )
            current = _new_question(interview, q_data)
        db.add(current)
        db.commit()
        db.refresh(current)
        db.refresh(interview)
        answers = _sorted_answers(interview)
    last_answer = answers[-1] if answers else None
    payload = {
        "id": interview.id,
        "mode": interview.mode or "text",
        "status": interview.status,
        "role_id": interview.role_id,
        "role_name": interview.role.name if interview.role else None,
        "company_id": interview.company_id,
        "company_name": interview.company.name if interview.company else None,
        "seniority": interview.seniority or "Mid",
        "questions_answered": len(answers),
        "total_questions": _total_questions(interview),
        "current_question": schemas.QuestionResponse.model_validate(current) if current else None,
        "last_evaluation": last_answer.rubric_json if last_answer else None,
    }
    if _is_video(interview):
        step_scores = _step_scores(_answer_pairs(answers))
        parent = db.get(models.Question, current.parent_id) if current and current.parent_id else None
        payload.update({
            "plan": interview.plan,
            "questions_answered": len(step_scores),
            "follow_ups_used": sum(1 for q in questions if q.parent_id),
            "parent_question": parent.question_text if parent else None,
            "step_scores": step_scores,
            "elapsed_seconds": round(sum((a.delivery or {}).get("duration") or 0 for a in answers)),
        })
    return payload

@app.get("/interviews/{interview_id}/current-question", response_model=schemas.QuestionResponse)
async def get_current_question(
    interview_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    interview = _get_owned_interview(db, interview_id, current_user)
    latest_question = db.query(models.Question).filter(models.Question.interview_id == interview.id).order_by(models.Question.id.desc()).first()
    if not latest_question:
        raise HTTPException(status_code=404, detail="No question generated yet")
    return latest_question

@app.post("/interviews/{interview_id}/answers", dependencies=[security.per_user("interview-answer", 60, 600)])
async def submit_answer(
    interview_id: int,
    data: schemas.AnswerSubmit,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    interview = _get_owned_interview(db, interview_id, current_user)
    if interview.status == "completed":
        raise HTTPException(status_code=409, detail="This interview is already completed")
    if _is_video(interview):
        raise HTTPException(status_code=409, detail="This is a video interview. Answer it in the interview room.")

    question = db.query(models.Question).filter(
        models.Question.id == data.question_id, models.Question.interview_id == interview.id
    ).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found in this interview")
    if db.query(models.Answer).filter(models.Answer.question_id == question.id).first():
        raise HTTPException(status_code=409, detail="This question has already been answered")

    previous_answers = (
        db.query(models.Answer).filter(models.Answer.interview_id == interview.id).order_by(models.Answer.id).all()
    )

    # All AI calls happen before any writes so no database lock is held while waiting.
    eval_data = await gemini_service.evaluate_answer_rubric(
        question_text=question.question_text,
        expected_concepts=question.expected_concepts or [],
        answer_text=data.answer_text
    )
    answered = len(previous_answers) + 1
    answer = models.Answer(
        interview_id=interview.id,
        question_id=question.id,
        answer_text=data.answer_text,
        score=eval_data["score"],
        rubric_json=eval_data,
        feedback=eval_data["feedback"]
    )

    if answered >= QUESTIONS_PER_INTERVIEW:
        overall = _overall_score(interview, [(None, a.score) for a in previous_answers] + [(None, eval_data["score"])])
        recs = await _completion_recommendations(
            db, interview, current_user, [a.rubric_json or {} for a in previous_answers] + [eval_data], [],
        )
        db.add(answer)
        _mark_completed(db, interview, current_user, overall, recs)
        db.commit()
        return {
            "status": "completed",
            "overall_score": overall,
            "evaluation": eval_data,
            "questions_answered": answered,
            "total_questions": QUESTIONS_PER_INTERVIEW,
        }

    # Next question, with the whole conversation so far as context
    prev_context = _previous_context(previous_answers)
    prev_context.append({
        "question": question.question_text,
        "answer_summary": data.answer_text[:250],
        "missing": eval_data.get("missing_concepts", []),
    })

    # Missed concepts reach the model through prev_context ("Gaps in Q1: ..."); weak_skills
    # stays the candidate's real skill gaps for the role.
    next_q_data = await gemini_service.generate_question(
        **_generation_context(db, interview, current_user),
        question_number=answered + 1,
        previous_qa_context=prev_context,
    )

    db.add(answer)
    next_q = _new_question(interview, next_q_data)
    db.add(next_q)
    db.commit()
    db.refresh(next_q)

    return {
        "status": "in_progress",
        "evaluation": eval_data,
        "next_question": schemas.QuestionResponse.model_validate(next_q),
        "questions_answered": answered,
        "total_questions": QUESTIONS_PER_INTERVIEW,
    }


def _json_form(value: str, limit: int, label: str) -> Any:
    if not value:
        return None
    if len(value) > limit:
        raise HTTPException(status_code=413, detail=f"The {label} data is too large.")
    try:
        return json.loads(value)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"The {label} data is not valid JSON.")


@app.post("/interviews/{interview_id}/video-answers", dependencies=[security.per_user("interview-answer", 60, 600)])
async def submit_video_answer(
    interview_id: int,
    question_id: int = Form(...),
    text: str = Form(""),
    text_source: str = Form("typed"),
    caption_segments: str = Form(""),
    code: str = Form(""),
    language: str = Form(""),
    delivery: str = Form(""),
    audio: Optional[UploadFile] = File(None),
    diagram: Optional[UploadFile] = File(None),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    """One answer in a video interview: the spoken answer's audio (transcribed by the AI), typed text or
    live captions, code for a coding step, and the whiteboard image for a design step."""
    interview = _get_owned_interview(db, interview_id, current_user)
    if interview.status == "completed":
        raise HTTPException(status_code=409, detail="This interview is already completed")
    if not _is_video(interview) or not interview.plan:
        raise HTTPException(status_code=409, detail="This is a text interview. Answer it in the Workspace.")

    question = db.query(models.Question).filter(
        models.Question.id == question_id, models.Question.interview_id == interview.id
    ).first()
    if not question or question.step_index is None or question.step_index >= len(interview.plan):
        raise HTTPException(status_code=404, detail="Question not found in this interview")
    if db.query(models.Answer).filter(models.Answer.question_id == question.id).first():
        raise HTTPException(status_code=409, detail="This question has already been answered")

    step = interview.plan[question.step_index]
    text = text.strip()
    if len(text) > 8000:
        raise HTTPException(status_code=413, detail="Your typed answer is too long. Keep it under 8,000 characters.")
    if len(code) > 20000:
        raise HTTPException(status_code=413, detail="Your code is too long. Keep it under 20,000 characters.")
    if step["kind"] == "code" and language not in (step.get("languages") or []):
        raise HTTPException(status_code=400, detail="Choose one of the languages offered for this problem.")
    source = text_source if text_source in ("captions", "typed") else "typed"
    client_delivery = _json_form(delivery, 20_000, "delivery") or {}
    captions = _json_form(caption_segments, 60_000, "caption") or []

    audio_bytes, audio_mime = None, ""
    if audio is not None:
        mime = (audio.content_type or "").split(";")[0].strip().lower()
        if mime not in ANSWER_AUDIO_TYPES:
            raise HTTPException(status_code=415, detail="Unsupported audio format. Record the answer again.")
        audio_bytes = await audio.read(settings.max_answer_audio_bytes + 1)
        if len(audio_bytes) > settings.max_answer_audio_bytes:
            raise HTTPException(status_code=413, detail="This recording is too long. Keep answers under about 8 minutes.")
        audio_bytes, audio_mime = (audio_bytes or None), ANSWER_AUDIO_TYPES[mime]

    image_bytes = None
    if diagram is not None and step["kind"] == "design":
        image_bytes = await diagram.read(MAX_DIAGRAM_BYTES + 1)
        if len(image_bytes) > MAX_DIAGRAM_BYTES:
            raise HTTPException(status_code=413, detail="The whiteboard image is too large.")
        if not image_bytes.startswith(PNG_SIGNATURE):
            raise HTTPException(status_code=415, detail="The whiteboard image must be a PNG.")

    if step["kind"] == "spoken" and not (audio_bytes or text):
        raise HTTPException(status_code=400, detail="Record or type an answer before submitting.")
    if step["kind"] == "code" and not code.strip():
        raise HTTPException(status_code=400, detail="Write some code before submitting.")
    if step["kind"] == "design" and not (image_bytes or text or audio_bytes):
        raise HTTPException(status_code=400, detail="Draw your design or explain it before submitting.")

    answers = _sorted_answers(interview)
    questions = interview.questions
    follow_ups_used = sum(1 for q in questions if q.parent_id)
    allow_follow_up = bool(step.get("follow_up")) and question.parent_id is None and follow_ups_used < MAX_FOLLOW_UPS
    parent = db.get(models.Question, question.parent_id) if question.parent_id else None
    duration = float(client_delivery.get("duration") or 0) if isinstance(client_delivery, dict) else 0.0

    # All AI calls happen before any writes so no database lock is held while waiting.
    eval_data = await video_interview.evaluate_answer(
        step, question, parent.question_text if parent else None, _video_context(db, interview, current_user),
        audio=audio_bytes, audio_mime=audio_mime, text=text, text_source=source, caption_segments=captions,
        code=code, language=language, image=image_bytes, allow_follow_up=allow_follow_up, duration=duration,
    )
    transcript = eval_data.get("transcript") or ""
    if step["kind"] == "spoken" and not transcript:
        if audio_bytes and eval_data.get("evaluator") == "fallback":
            detail = ("The AI that transcribes answers is busy right now, and live captions weren't available. "
                      "Type your answer, or try again in a moment.")
        else:
            detail = "We couldn't hear an answer in that recording. Check your microphone and try again, or type your answer."
        raise HTTPException(status_code=422, detail=detail)
    follow_up_text = eval_data.pop("follow_up", None)
    segments = eval_data.pop("segments", [])
    eval_data.pop("transcript", None)
    source = eval_data.pop("transcript_source", source)
    # Pace and filler words come only from what was said (an AI transcript or live captions), never typed notes.
    delivery_record = delivery_service.build_delivery(client_delivery, transcript, spoken=source in ("ai", "captions"))

    pairs = _answer_pairs(answers) + [(question.step_index, eval_data["score"])]
    wants_follow_up = allow_follow_up and follow_up_text and 3.0 <= eval_data["score"] < 8.5
    next_index = question.step_index + 1
    next_q = None
    recs: List[Dict[str, Any]] = []
    history = _video_history(answers) + [{"question": question.question_text, "answer_summary": (transcript or code)[:250]}]
    if wants_follow_up:
        next_q = _new_question(
            interview, {"question_text": follow_up_text, "difficulty": question.difficulty,
                        "expected_concepts": (eval_data.get("missing_concepts") or question.expected_concepts or [])[:3]},
            kind="spoken", step_index=question.step_index, parent_id=question.id,
        )
    elif next_index < len(interview.plan):
        next_q = await _step_question(db, interview, current_user, next_index, history)
    else:
        recs = await _completion_recommendations(
            db, interview, current_user, [a.rubric_json or {} for a in answers] + [eval_data],
            [a.delivery for a in answers] + [delivery_record],
        )

    answer = models.Answer(
        interview_id=interview.id,
        question_id=question.id,
        answer_text=transcript,
        score=eval_data["score"],
        rubric_json=eval_data,
        feedback=eval_data["feedback"],
        transcript_source=source,
        segments=segments,
        code=code or None,
        code_language=language or None,
        diagram_image=f"data:image/png;base64,{base64.b64encode(image_bytes).decode()}" if image_bytes else None,
        delivery=delivery_record,
    )
    db.add(answer)
    completed = next_q is None
    overall = _overall_score(interview, pairs)
    if completed:
        _mark_completed(db, interview, current_user, overall, recs)
    else:
        db.add(next_q)
    db.commit()
    if next_q is not None:
        db.refresh(next_q)

    step_scores = _step_scores(pairs)
    return {
        "status": "completed" if completed else "in_progress",
        "evaluation": {**eval_data, "transcript": transcript, "segments": segments, "transcript_source": source},
        "delivery": delivery_record,
        "next_question": schemas.QuestionResponse.model_validate(next_q) if next_q else None,
        "is_follow_up": bool(next_q is not None and next_q.parent_id),
        "step_score": step_scores.get(question.step_index),
        "questions_answered": len(step_scores),
        "total_questions": len(interview.plan),
        "overall_score": overall if completed else None,
    }


@app.post("/interviews/{interview_id}/finish", dependencies=[security.per_user("interview-finish", 20, 600)])
async def finish_interview(
    interview_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    """Ends an interview early. Answered questions are scored; the rest count as skipped."""
    interview = _get_owned_interview(db, interview_id, current_user)
    if interview.status == "completed":
        raise HTTPException(status_code=409, detail="This interview is already completed")
    answers = _sorted_answers(interview)
    recs = await _completion_recommendations(
        db, interview, current_user, [a.rubric_json or {} for a in answers], [a.delivery for a in answers],
    )
    overall = _overall_score(interview, _answer_pairs(answers))
    _mark_completed(db, interview, current_user, overall, recs)
    db.commit()
    answered = len(_step_scores(_answer_pairs(answers))) if _is_video(interview) else len(answers)
    return {
        "status": "completed",
        "overall_score": overall,
        "questions_answered": answered,
        "total_questions": _total_questions(interview),
    }


def _video_steps(interview: models.Interview, answers: List[models.Answer]) -> List[Dict[str, Any]]:
    by_question = {a.question_id: a for a in answers}
    step_scores = _step_scores(_answer_pairs(answers))
    steps = []
    for step in interview.plan or []:
        questions = sorted((q for q in interview.questions if q.step_index == step["index"]), key=lambda q: q.id)
        items = []
        for q in questions:
            a = by_question.get(q.id)
            if a is None and q.parent_id:
                continue  # a follow-up that was never answered
            items.append({
                "id": q.id,
                "question": q.question_text,
                "is_follow_up": bool(q.parent_id),
                "details": q.details,
                "expected_concepts": q.expected_concepts or [],
                "answer": None if a is None else {
                    "id": a.id,
                    "text": a.answer_text,
                    "transcript_source": a.transcript_source,
                    "segments": a.segments or [],
                    "delivery": a.delivery,
                    "code": a.code,
                    "language": a.code_language,
                    "diagram_image": a.diagram_image,
                    "score": a.score,
                    "rubric": a.rubric_json or {},
                    "feedback": a.feedback,
                    "evaluator": (a.rubric_json or {}).get("evaluator", "ai"),
                },
            })
        answered = any(item["answer"] for item in items)
        steps.append({
            **step,
            "status": "answered" if answered else "skipped",
            "score": step_scores.get(step["index"]),
            "duration": round(sum(((item["answer"] or {}).get("delivery") or {}).get("duration") or 0 for item in items)),
            "questions": items,
        })
    return steps


@app.get("/interviews/{interview_id}/results")
async def get_interview_results(
    interview_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    interview = _get_owned_interview(db, interview_id, current_user)
    answers = _sorted_answers(interview)

    evaluations = []
    for a in answers:
        rubric = a.rubric_json or {}
        evaluations.append({
            "question_id": a.question_id,
            "question": a.question.question_text if a.question else "Question",
            "expected_concepts": (a.question.expected_concepts or []) if a.question else [],
            "user_answer": a.answer_text,
            "score": a.score,
            "rubric": rubric,
            "detected_concepts": rubric.get("detected_concepts", []),
            "missing_concepts": rubric.get("missing_concepts", []),
            "evaluator": rubric.get("evaluator", "ai"),
            "feedback": a.feedback
        })

    recommendations = sorted(interview.recommendations, key=lambda r: r.id)
    results = {
        "interview_id": interview.id,
        "mode": interview.mode or "text",
        "status": interview.status,
        "overall_score": interview.overall_score,
        "role_name": interview.role.name if interview.role else None,
        "company_name": interview.company.name if interview.company else None,
        "seniority": interview.seniority,
        "started_at": interview.started_at,
        "completed_at": interview.completed_at,
        "questions_answered": len(answers),
        "total_questions": _total_questions(interview),
        "used_fallback_evaluator": any(e["evaluator"] == "fallback" for e in evaluations),
        "evaluations": evaluations,
        "recommendations": [schemas.RecommendationResponse.model_validate(r) for r in recommendations],
    }
    if _is_video(interview):
        steps = _video_steps(interview, answers)
        results.update({
            "plan": interview.plan,
            "steps": steps,
            "questions_answered": sum(1 for s in steps if s["status"] == "answered"),
            "follow_ups": sum(1 for s in steps for q in s["questions"] if q["is_follow_up"]),
            "delivery": delivery_service.summarize(a.delivery for a in answers),
        })
    return results

# --- RECOMMENDATIONS ENDPOINT (SRS FR-15 & Section 10.6) ---

@app.get("/recommendations", response_model=list[schemas.RecommendationResponse])
async def get_recommendations(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    return db.query(models.Recommendation).filter(models.Recommendation.user_id == current_user.id).order_by(models.Recommendation.id.desc()).all()


# --- FRONTEND (production builds only) ---
# The Docker image copies the built React app into STATIC_DIR. Registered last so every API
# route above takes precedence; any other path returns index.html for client-side routing.
if _serves_frontend:
    if (_static_dir / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=_static_dir / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        candidate = (_static_dir / full_path).resolve()
        if full_path and candidate.is_file() and _static_dir in candidate.parents:
            return FileResponse(candidate)
        # A missing file (anything with a dot in its last segment, such as /.env or /db.sqlite)
        # is a plain 404, so scanners don't mistake the app page for an exposed file. Other paths
        # are client-side routes and get the app.
        if "." in full_path.rsplit("/", 1)[-1]:
            raise HTTPException(status_code=404, detail="Not found")
        return FileResponse(_static_dir / "index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "8000")),
        # Auto-reload is a development convenience; turn it on with RELOAD=true.
        reload=os.getenv("RELOAD", "false").lower() == "true" and not settings.is_production,
        server_header=False,
    )
