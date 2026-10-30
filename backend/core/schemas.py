import re
import unicodedata
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import List, Literal, Optional, Dict, Any
from datetime import datetime

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
Seniority = Literal["Junior", "Mid", "Senior"]
# Characters with no place in a person's name, and that would matter if a name were ever put
# into HTML or a spreadsheet outside React's escaping (a leading = + - @ starts a formula).
NAME_MARKUP = re.compile(r"[<>\"`{}\\]")
FORMULA_PREFIX = "=+-@"


def _normalize_email(value: str) -> str:
    email = (value or "").strip().lower()
    if not EMAIL_PATTERN.match(email) or len(email) > 254:
        raise ValueError("Enter a valid email address")
    return email


def clean_display_name(value: str, limit: int = 120) -> str:
    """Normalizes a name: Unicode NFC, no control or invisible formatting characters, single
    spaces, no markup characters. Used for names typed in forms and names from Google."""
    text = unicodedata.normalize("NFC", value or "")
    text = "".join(ch for ch in text if unicodedata.category(ch) not in ("Cc", "Cf", "Cs", "Co"))
    text = NAME_MARKUP.sub("", " ".join(text.split()))
    return text.lstrip(FORMULA_PREFIX + " ")[:limit].strip()


def _validated_name(value: Optional[str]) -> Optional[str]:
    """Rejects names a person would not type (with a clear message); quietly cleans the rest."""
    if value is None:
        return None
    if NAME_MARKUP.search(value) or value.strip()[:1] in tuple(FORMULA_PREFIX):
        raise ValueError("Names can't contain < > \" ` { } \\ or start with = + - @")
    return clean_display_name(value)


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

    @field_validator("name", "full_name")
    @classmethod
    def _clean_name(cls, value: Optional[str]) -> Optional[str]:
        return _validated_name(value)

    def get_display_name(self) -> str:
        return (self.name or self.full_name or "").strip() or self.email.split("@")[0]

class UserLogin(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=128)

    @field_validator("email")
    @classmethod
    def _lower(cls, value: str) -> str:
        return (value or "").strip().lower()

class GoogleLoginRequest(BaseModel):
    token: str = Field(max_length=4096)

class UserUpdate(BaseModel):
    """Only the fields that are sent change. An empty country removes it."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    country: Optional[str] = Field(default=None, max_length=2)

    @field_validator("name")
    @classmethod
    def _not_blank(cls, value: Optional[str]) -> str:
        cleaned = _validated_name(value)
        if not cleaned:
            raise ValueError("Name cannot be empty")
        return cleaned

class ProfileLinksUpdate(BaseModel):
    """Only the fields that are sent change; an empty string or null removes a link."""
    linkedin: Optional[str] = Field(default=None, max_length=300)
    github: Optional[str] = Field(default=None, max_length=300)

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
    in_progress_interviews: int = 0

class UserProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: Optional[str]
    email: str
    country: Optional[str] = None
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
    mode: Literal["text", "video"] = "text"

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
    kind: str = "spoken"                       # spoken, code, design (video interviews)
    step_index: Optional[int] = None
    parent_id: Optional[int] = None            # set on follow-up questions
    details: Optional[Dict[str, Any]] = None   # coding problem or design brief

class RecommendationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    interview_id: Optional[int] = None
    topic: Optional[str] = None
    priority: Optional[str] = "Medium"
    reason: Optional[str] = None

# --- RESUME SHOWCASE SCHEMAS ---
class ShowcaseOptions(BaseModel):
    """What a published resume shows. Names of colleges and companies are hidden unless chosen."""
    role_id: int
    seniority: Seniority = "Mid"
    show_name: bool = False
    show_country: bool = True
    show_institutions: bool = False
    show_companies: bool = False

class ShowcasePublish(ShowcaseOptions):
    confirm: bool = False   # the owner has seen the preview and agrees to publish it

class ShowcaseReportCreate(BaseModel):
    reason: Literal["personal_details", "offensive", "fake"]

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
