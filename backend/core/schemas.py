import re
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import List, Literal, Optional, Dict, Any
from datetime import datetime

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
Seniority = Literal["Junior", "Mid", "Senior"]


def _normalize_email(value: str) -> str:
    email = (value or "").strip().lower()
    if not EMAIL_PATTERN.match(email) or len(email) > 254:
        raise ValueError("Enter a valid email address")
    return email


# --- AUTH SCHEMAS ---
class UserRegister(BaseModel):
    name: Optional[str] = Field(default=None, max_length=120)
    full_name: Optional[str] = Field(default=None, max_length=120)
    email: str
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def _valid_email(cls, value: str) -> str:
        return _normalize_email(value)

    def get_display_name(self) -> str:
        return (self.name or self.full_name or "").strip() or self.email.split("@")[0]

class UserLogin(BaseModel):
    email: str
    password: str = Field(max_length=128)

    @field_validator("email")
    @classmethod
    def _lower(cls, value: str) -> str:
        return (value or "").strip().lower()

class GoogleLoginRequest(BaseModel):
    token: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user: Optional[Dict[str, Any]] = None

class UserStats(BaseModel):
    total_interviews: int = 0
    avg_score: float = 0.0
    completed_interviews: int = 0

class UserProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: Optional[str]
    email: str
    created_at: Optional[datetime] = None

# --- ROLE & SKILL SCHEMAS ---
class SkillSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    canonical_name: str
    category: Optional[str] = None

class RoleSkillSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    skill: SkillSchema
    importance_weight: float

class RoleSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: Optional[str] = "Software & Systems"
    description: Optional[str]
    required_skills: List[SkillSchema] = []

# --- RESUME SCHEMAS ---
class ResumeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: Optional[str]
    status: str
    uploaded_at: datetime
    extracted_skills: List[str] = []

# --- COMPANY SCHEMAS ---
class CompanySchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    tier: str
    industry: str
    domain: Optional[str] = None
    logo_url: Optional[str] = None
    interview_focus: List[str] = []
    common_topics: List[str] = []
    difficulty_level: str
    headquarters: Optional[str] = None
    description: Optional[str] = None
    what_company_wants: Optional[str] = None
    interview_rounds: List[str] = []
    prep_tips: List[str] = []

# --- SKILL GAP SCHEMAS ---
class SkillGapDetail(BaseModel):
    name: str
    status: Literal["strong", "developing", "weak", "missing"]
    importance_weight: float
    matched_via: List[str] = []   # resume skills that satisfied this requirement
    mentions: int = 0             # how often those skills appear in the resume

class SkillGapResponse(BaseModel):
    role_name: str
    readiness_score: float # 0 to 100%, weighted by requirement importance
    strong_skills: List[str]
    developing_skills: List[str]
    weak_skills: List[str]
    missing_skills: List[str]
    skill_details: List[SkillGapDetail] = []
    candidate_skill_count: int = 0
    has_active_resume: bool = False

# --- INTERVIEW SCHEMAS ---
class InterviewCreate(BaseModel):
    role_id: int
    company_id: Optional[int] = None
    seniority: Seniority = "Mid"
    job_description: Optional[str] = Field(default=None, max_length=10000)

class AnswerSubmit(BaseModel):
    question_id: int
    answer_text: str = Field(min_length=1, max_length=8000)

    @field_validator("answer_text")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Answer cannot be empty")
        return value.strip()

class RubricEvaluation(BaseModel):
    score: float
    correctness: float
    relevance: float
    completeness: float
    detected_concepts: List[str]
    missing_concepts: List[str]
    feedback: str

class QuestionResponse(BaseModel):
    """What the candidate sees while answering. Expected concepts stay hidden until it is answered."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    interview_id: int
    question_text: str
    difficulty: Optional[str] = "Medium"

class RecommendationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    interview_id: Optional[int] = None
    topic: Optional[str] = None
    priority: Optional[str] = "Medium"
    reason: Optional[str] = None

# --- ADVANCED RESUME & JD INTELLIGENCE SCHEMAS ---
class PersonalInfo(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin: Optional[str] = None
    github: Optional[str] = None
    portfolio: Optional[str] = None

class EducationItem(BaseModel):
    degree: Optional[str] = None
    field: Optional[str] = None
    institution: Optional[str] = None
    graduation_year: Optional[str] = None
    grade: Optional[str] = None

class ProjectItem(BaseModel):
    name: str
    description: Optional[str] = None
    technologies: List[str] = []
    domain: Optional[str] = None
    methods: Optional[str] = None

class ExperienceItem(BaseModel):
    company: str
    role: str
    duration: Optional[str] = None
    responsibilities: List[str] = []
    technologies: List[str] = []

class CertificationItem(BaseModel):
    name: str
    issuer: Optional[str] = None
    year: Optional[str] = None

class SkillEvidenceItem(BaseModel):
    name: str
    category: str
    evidence: str
    confidence: float = 0.95
    mentions: int = 1

class ResumeQualityAnalysis(BaseModel):
    completeness_score: int
    sections_detected: Dict[str, bool]
    skill_distribution: Dict[str, Any]
    total_skills_count: int
    improvement_feedback: List[str] = []

class CandidateProfileDetailed(BaseModel):
    resume_id: int
    filename: Optional[str] = None
    personal_info: PersonalInfo
    skills: List[str] = []
    categorized_skills: Dict[str, List[str]] = {}
    skills_with_evidence: List[SkillEvidenceItem] = []
    education: List[EducationItem] = []
    projects: List[ProjectItem] = []
    experience: List[ExperienceItem] = []
    certifications: List[CertificationItem] = []
    quality_analysis: Optional[ResumeQualityAnalysis] = None

# --- JOB DESCRIPTION INTELLIGENCE SCHEMAS ---
class JobAnalysisRequest(BaseModel):
    jd_text: str = Field(max_length=10000)
    role_title: Optional[str] = Field(default=None, max_length=200)

class JobSkillRequirement(BaseModel):
    name: str
    category: str = "Technical"
    importance: str = "Required" # Required, Preferred, Supporting
    evidence: Optional[str] = None

class SoftSkillRequirement(BaseModel):
    name: str
    evidence: Optional[str] = None

class JobAnalysisResponse(BaseModel):
    job_info: Dict[str, Any]
    experience_requirements: str
    education_requirements: str
    required_skills: List[JobSkillRequirement] = []
    preferred_skills: List[JobSkillRequirement] = []
    categorized_required_skills: Dict[str, List[str]] = {}
    soft_skills: List[SoftSkillRequirement] = []
    total_required_count: int = 0
    total_preferred_count: int = 0
