from sqlalchemy import Boolean, Column, Integer, String, Float, DateTime, ForeignKey, Text, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from .database import Base
import datetime


def utcnow() -> datetime.datetime:
    """Naive UTC timestamp, matching the values already stored in the database."""
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String, nullable=True) # NULL for Google / demo accounts that have no password
    linkedin_handle = Column(String, nullable=True) # the part after linkedin.com/in/
    github_username = Column(String, nullable=True)
    github_data = Column(JSON, nullable=True) # last public-profile import (repos, languages, skills)
    github_synced_at = Column(DateTime, nullable=True)
    country = Column(String(2), nullable=True) # ISO 3166-1 alpha-2 code, used for benchmarks and the showcase
    created_at = Column(DateTime, default=utcnow)

    resumes = relationship("Resume", back_populates="user", cascade="all, delete-orphan")
    candidate_skills = relationship("CandidateSkill", back_populates="user", cascade="all, delete-orphan")
    interviews = relationship("Interview", back_populates="user", cascade="all, delete-orphan")
    recommendations = relationship("Recommendation", back_populates="user", cascade="all, delete-orphan")
    showcase = relationship("ResumeShowcase", back_populates="user", uselist=False, cascade="all, delete-orphan")

class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True) # e.g. "Software Engineer (SDE)", "Frontend Developer"
    category = Column(String, default="Software & Systems") # e.g. "Software & Systems", "AI & Data", "Hardware & VLSI", etc.
    description = Column(Text, nullable=True)

    role_skills = relationship("RoleSkill", back_populates="role", cascade="all, delete-orphan")
    interviews = relationship("Interview", back_populates="role")

class Skill(Base):
    __tablename__ = "skills"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    canonical_name = Column(String, index=True) # e.g. "PostgreSQL" for "Postgres"
    category = Column(String, default="Technical") # e.g., Programming, Framework, Database, Soft Skill

    role_skills = relationship("RoleSkill", back_populates="skill", cascade="all, delete-orphan")
    candidate_skills = relationship("CandidateSkill", back_populates="skill", cascade="all, delete-orphan")

class RoleSkill(Base):
    __tablename__ = "role_skills"
    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id"))
    skill_id = Column(Integer, ForeignKey("skills.id"))
    importance_weight = Column(Float, default=1.0) # 1.0 = Standard, 2.0 = High Importance

    role = relationship("Role", back_populates="role_skills")
    skill = relationship("Skill", back_populates="role_skills")

class Resume(Base):
    __tablename__ = "resumes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    file_path = Column(String, nullable=True)
    filename = Column(String, nullable=True)
    raw_text = Column(Text, nullable=True)
    extracted_skills_json = Column(JSON, default=[])
    parsed_profile_json = Column(JSON, default={})
    quality_analysis_json = Column(JSON, default={})
    status = Column(String, default="pending") # pending, parsed, failed
    is_active = Column(Boolean, default=False, nullable=False) # the resume the candidate profile is built from
    uploaded_at = Column(DateTime, default=utcnow)

    user = relationship("User", back_populates="resumes")

class CandidateSkill(Base):
    __tablename__ = "candidate_skills"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    skill_id = Column(Integer, ForeignKey("skills.id"))
    confidence = Column(Float, default=0.8) # 0.0 to 1.0
    source = Column(String, default="resume") # resume, assessment
    updated_at = Column(DateTime, default=utcnow)

    user = relationship("User", back_populates="candidate_skills")
    skill = relationship("Skill", back_populates="candidate_skills")

class Company(Base):
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    tier = Column(String, default="Tier-2")  # FAANG, Tier-1, Tier-2, Startup, Fintech, Enterprise, Consulting, Other
    industry = Column(String, default="Technology")
    domain = Column(String, nullable=True)  # e.g. google.com, stripe.com
    logo_url = Column(String, nullable=True)  # Official logo URL
    interview_focus = Column(JSON, default=[])  # e.g. ["DSA Heavy", "System Design", "Behavioral"]
    common_topics = Column(JSON, default=[])  # e.g. ["Trees", "Graphs", "DP", "API Design"]
    difficulty_level = Column(String, default="Medium")  # Easy, Medium, Hard
    headquarters = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    what_company_wants = Column(Text, nullable=True)  # What the company seeks in a candidate
    interview_rounds = Column(JSON, default=[])  # Step-by-step interview rounds breakdown
    prep_tips = Column(JSON, default=[])  # Actionable prep advice

    interviews = relationship("Interview", back_populates="company")

class Interview(Base):
    __tablename__ = "interviews"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    status = Column(String, default="in_progress") # in_progress, completed
    seniority = Column(String, default="Mid", nullable=True) # Junior, Mid, Senior
    job_description = Column(Text, nullable=True) # optional JD the candidate pasted
    jd_skills = Column(JSON, default=[]) # required skills extracted from the JD
    overall_score = Column(Float, nullable=True)
    mode = Column(String, default="text", server_default="text", nullable=False) # text, video
    plan = Column(JSON, nullable=True) # video interviews: ordered steps (services/interview_plan.py)
    started_at = Column(DateTime, default=utcnow)
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="interviews")
    role = relationship("Role", back_populates="interviews")
    company = relationship("Company", back_populates="interviews")
    questions = relationship("Question", back_populates="interview", cascade="all, delete-orphan")
    answers = relationship("Answer", back_populates="interview", cascade="all, delete-orphan")
    recommendations = relationship("Recommendation", back_populates="interview")

class Question(Base):
    __tablename__ = "questions"
    id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(Integer, ForeignKey("interviews.id"))
    skill_id = Column(Integer, ForeignKey("skills.id"), nullable=True)
    question_text = Column(Text)
    difficulty = Column(String, default="Medium") # Easy, Medium, Hard
    expected_concepts = Column(JSON, default=[]) # e.g. ["Indexing", "Query Plan"]
    kind = Column(String, default="spoken", server_default="spoken", nullable=False) # spoken, code, design
    step_index = Column(Integer, nullable=True) # video interviews: position in interview.plan
    parent_id = Column(Integer, ForeignKey("questions.id"), nullable=True) # set on follow-up questions
    details = Column(JSON, nullable=True) # coding problem or design brief shown with the question

    interview = relationship("Interview", back_populates="questions")
    answers = relationship("Answer", back_populates="question")

class Answer(Base):
    __tablename__ = "answers"
    id = Column(Integer, primary_key=True, index=True)
    interview_id = Column(Integer, ForeignKey("interviews.id"))
    question_id = Column(Integer, ForeignKey("questions.id"))
    answer_text = Column(Text)
    score = Column(Float) # 0.0 to 10.0
    rubric_json = Column(JSON, default={}) # { correctness, relevance, completeness, detected_concepts, missing_concepts }
    feedback = Column(Text)
    # Video interviews only
    transcript_source = Column(String, nullable=True) # ai, captions, typed
    segments = Column(JSON, nullable=True) # [{"start": seconds, "text": "..."}]
    code = Column(Text, nullable=True)
    code_language = Column(String, nullable=True)
    diagram_image = Column(Text, nullable=True) # PNG data URL of the whiteboard
    delivery = Column(JSON, nullable=True) # pace, filler words, pauses, eye contact
    evaluated_at = Column(DateTime, default=utcnow)

    interview = relationship("Interview", back_populates="answers")
    question = relationship("Question", back_populates="answers")

class Recommendation(Base):
    __tablename__ = "recommendations"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    interview_id = Column(Integer, ForeignKey("interviews.id"), nullable=True)
    skill_id = Column(Integer, ForeignKey("skills.id"), nullable=True)
    topic = Column(String, nullable=True)
    priority = Column(String, default="High") # High, Medium, Low
    reason = Column(Text)
    created_at = Column(DateTime, default=utcnow)

    user = relationship("User", back_populates="recommendations")
    interview = relationship("Interview", back_populates="recommendations")

class ResumeShowcase(Base):
    """A resume the owner chose to publish. `content` is a redacted copy made at publish time,
    so later uploads never change what others see until the owner updates it."""
    __tablename__ = "resume_showcases"
    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(String, unique=True, index=True, nullable=False) # used in URLs instead of the row id
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    resume_id = Column(Integer, ForeignKey("resumes.id"), nullable=True) # the resume the copy was made from
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    seniority = Column(String, default="Mid", nullable=False)
    handle = Column(String, nullable=False) # anonymous name, e.g. "Quiet Falcon 42"
    show_name = Column(Boolean, default=False, nullable=False)
    content = Column(JSON, nullable=False)
    options = Column(JSON, nullable=True) # what the owner chose to show: institutions, companies
    hidden = Column(Boolean, default=False, nullable=False) # set after enough reports from other users
    published_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow)

    user = relationship("User", back_populates="showcase")
    role = relationship("Role")
    reports = relationship("ShowcaseReport", back_populates="showcase", cascade="all, delete-orphan")

class ShowcaseReport(Base):
    __tablename__ = "showcase_reports"
    __table_args__ = (UniqueConstraint("showcase_id", "reporter_id", name="uq_showcase_reports_reporter"),)
    id = Column(Integer, primary_key=True, index=True)
    showcase_id = Column(Integer, ForeignKey("resume_showcases.id"), nullable=False)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reason = Column(String, nullable=False) # personal_details, offensive, fake
    created_at = Column(DateTime, default=utcnow)

    showcase = relationship("ResumeShowcase", back_populates="reports")
