import logging
import os
import secrets
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from sqlalchemy.orm import Session, selectinload

from auth import auth_utils
from core import database, models, schemas, seed_data
from core.config import QUESTIONS_PER_INTERVIEW, settings
from core.migrations import run_migrations
from services.candidate_profile import activate_resume, candidate_skill_names, clear_resume_skills, get_active_resume
from services.gemini_service import gemini_service
from services.jd_intelligence import jd_intelligence_service
from services.resume_intelligence import resume_intelligence_service
from services.skill_gap import HIGH_IMPORTANCE, compute_skill_gap, merge_jd_requirements, unmet_requirements

logging.basicConfig(level=logging.INFO, format="%(levelname)s [%(name)s] %(message)s")
logger = logging.getLogger("prepsphere")

APP_VERSION = "1.1.0"
ALLOWED_RESUME_EXTENSIONS = (".pdf", ".docx", ".txt")

if not settings.secret_key:
    raise RuntimeError(
        "SECRET_KEY is not set. Add it to backend/.env; generate one with: "
        "python -c \"import secrets; print(secrets.token_urlsafe(48))\""
    )
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
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

@app.post("/auth/register", response_model=schemas.Token)
@app.post("/auth/signup", response_model=schemas.Token)
async def register(user_data: schemas.UserRegister, db: Session = Depends(database.get_db)):
    if auth_utils.get_user_by_email(db, user_data.email):
        raise HTTPException(status_code=400, detail="Email is already registered")

    hashed_pw = await run_in_threadpool(auth_utils.get_password_hash, user_data.password)
    user = models.User(name=user_data.get_display_name(), email=user_data.email, password_hash=hashed_pw)
    db.add(user)
    db.commit()
    db.refresh(user)
    return _token_response(user)

@app.post("/auth/login", response_model=schemas.Token)
async def login(login_data: schemas.UserLogin, db: Session = Depends(database.get_db)):
    user = auth_utils.get_user_by_email(db, login_data.email)
    valid = user is not None and await run_in_threadpool(
        auth_utils.verify_password, login_data.password, user.password_hash
    )
    if not valid:
        raise HTTPException(status_code=400, detail="Invalid email or password")
    return _token_response(user)

@app.post("/auth/google", response_model=schemas.Token)
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
        user = models.User(email=email, name=idinfo.get("name") or email.split("@")[0], password_hash=None)
        db.add(user)
        db.commit()
        db.refresh(user)
    return _token_response(user)

@app.post("/auth/demo", response_model=schemas.Token)
async def demo_login(db: Session = Depends(database.get_db)):
    """Creates a fresh, private demo account so demo visitors never see each other's data."""
    if not settings.demo_login_enabled:
        raise HTTPException(status_code=404, detail="Demo login is disabled")
    user = models.User(
        name="Demo Candidate",
        email=f"demo-{secrets.token_hex(8)}@demo.prepsphere.local",
        password_hash=None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _token_response(user)

@app.get("/users/me", response_model=schemas.UserProfile)
async def get_me(current_user: models.User = Depends(auth_utils.get_current_user)):
    return current_user

@app.get("/users/stats", response_model=schemas.UserStats)
async def get_user_stats(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    interviews = db.query(models.Interview).filter(models.Interview.user_id == current_user.id).all()
    completed = [i for i in interviews if i.status == "completed"]
    scores = [i.overall_score for i in completed if i.overall_score is not None]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0
    return schemas.UserStats(total_interviews=len(interviews), completed_interviews=len(completed), avg_score=avg_score)

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

@app.post("/resumes/upload")
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
    detected_name = analysis.get("personal_info", {}).get("name")
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
    db.delete(resume)
    if was_active:
        clear_resume_skills(db, current_user)
    db.commit()
    return {"message": "Resume deleted successfully", "was_active": was_active}

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

@app.post("/jobs/analyze", response_model=schemas.JobAnalysisResponse)
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

@app.post("/interviews")
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
    )
    interview.role = role
    interview.company = company

    # Generate the first question before writing anything, so no database lock is held
    # while waiting on the AI model.
    q_data = await gemini_service.generate_question(
        **_generation_context(db, interview, current_user),
        question_number=1,
        previous_qa_context=[],
    )

    db.add(interview)
    db.flush()
    question = models.Question(
        interview_id=interview.id,
        question_text=q_data["question_text"],
        difficulty=q_data.get("difficulty", "Medium"),
        expected_concepts=q_data.get("expected_concepts", []),
    )
    db.add(question)
    db.commit()
    db.refresh(question)

    return {
        "interview_id": interview.id,
        "question": schemas.QuestionResponse.model_validate(question),
        "total_questions": QUESTIONS_PER_INTERVIEW,
        "jd_skills": jd_skills,
    }

@app.get("/interviews/history")
async def get_interview_history(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    interviews = db.query(models.Interview).filter(models.Interview.user_id == current_user.id).order_by(models.Interview.started_at.desc()).all()
    return [
        {
            "id": i.id,
            "role_name": i.role.name if i.role else "Target Role",
            "company_name": i.company.name if i.company else None,
            "seniority": i.seniority,
            "status": i.status,
            "overall_score": i.overall_score,
            "started_at": i.started_at,
            "completed_at": i.completed_at,
        }
        for i in interviews
    ]

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

@app.post("/interviews/{interview_id}/answers")
async def submit_answer(
    interview_id: int,
    data: schemas.AnswerSubmit,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    interview = _get_owned_interview(db, interview_id, current_user)
    if interview.status == "completed":
        raise HTTPException(status_code=409, detail="This interview is already completed")

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
        scores = [a.score for a in previous_answers if a.score is not None] + [eval_data["score"]]
        overall = round(sum(scores) / len(scores), 1)

        weak_topics: List[str] = []
        for rubric in [a.rubric_json or {} for a in previous_answers] + [eval_data]:
            for concept in rubric.get("missing_concepts", []):
                if concept not in weak_topics:
                    weak_topics.append(concept)
        context = _generation_context(db, interview, current_user)
        requirements = merge_jd_requirements(_role_requirements(interview.role), interview.jd_skills or [])
        missing_skills = [
            name for name, weight in unmet_requirements(requirements, context["candidate_skills"])
            if weight >= HIGH_IMPORTANCE
        ]
        recs = await gemini_service.generate_recommendations(
            missing_skills=missing_skills[:5], weak_topics=weak_topics[:8], role_name=context["role_name"]
        )

        db.add(answer)
        interview.status = "completed"
        interview.overall_score = overall
        interview.completed_at = models.utcnow()
        for r in recs:
            db.add(models.Recommendation(
                user_id=current_user.id,
                interview_id=interview.id,
                topic=r["topic"],
                priority=r["priority"],
                reason=r["reason"],
            ))
        db.commit()
        return {
            "status": "completed",
            "overall_score": overall,
            "evaluation": eval_data,
            "questions_answered": answered,
            "total_questions": QUESTIONS_PER_INTERVIEW,
        }

    # Next question, with the whole conversation so far as context
    prev_context = []
    for pa in previous_answers:
        if pa.question:
            prev_context.append({
                "question": pa.question.question_text,
                "answer_summary": (pa.answer_text or "")[:250],
                "missing": (pa.rubric_json or {}).get("missing_concepts", []),
            })
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
    next_q = models.Question(
        interview_id=interview.id,
        question_text=next_q_data["question_text"],
        difficulty=next_q_data.get("difficulty", "Medium"),
        expected_concepts=next_q_data.get("expected_concepts", [])
    )
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

@app.get("/interviews/{interview_id}/results")
async def get_interview_results(
    interview_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    interview = _get_owned_interview(db, interview_id, current_user)
    answers = db.query(models.Answer).filter(models.Answer.interview_id == interview.id).order_by(models.Answer.id).all()

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
    return {
        "interview_id": interview.id,
        "status": interview.status,
        "overall_score": interview.overall_score,
        "role_name": interview.role.name if interview.role else None,
        "company_name": interview.company.name if interview.company else None,
        "seniority": interview.seniority,
        "started_at": interview.started_at,
        "completed_at": interview.completed_at,
        "questions_answered": len(answers),
        "total_questions": QUESTIONS_PER_INTERVIEW,
        "used_fallback_evaluator": any(e["evaluator"] == "fallback" for e in evaluations),
        "evaluations": evaluations,
        "recommendations": [schemas.RecommendationResponse.model_validate(r) for r in recommendations],
    }

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
_static_dir = settings.static_dir.resolve()
if (_static_dir / "index.html").is_file():
    if (_static_dir / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=_static_dir / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        candidate = (_static_dir / full_path).resolve()
        if full_path and candidate.is_file() and _static_dir in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(_static_dir / "index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("RELOAD", "true").lower() == "true",
    )
