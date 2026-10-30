"""
Application settings, read once from the environment (and backend/.env).

Every module reads configuration through `settings` so there is exactly one place
that knows about environment variables and their defaults.
"""
import logging
import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")

logger = logging.getLogger(__name__)

QUESTIONS_PER_INTERVIEW = 5
SENIORITY_LEVELS = ("Junior", "Mid", "Senior")
DEMO_EMAIL_DOMAIN = "demo.prepsphere.local" # throwaway demo accounts; left out of benchmarks and the showcase

DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    try:
        return int(value)
    except ValueError:
        logger.warning("Ignoring non-integer value for %s: %r", name, value)
        return default


def _resolve_database_url(url: str | None) -> str:
    """Anchor relative SQLite paths to the backend folder so the app finds the same
    database file no matter which directory it is started from."""
    if not url:
        return f"sqlite:///{(BACKEND_DIR / 'interview_prep.db').as_posix()}"
    prefix = "sqlite:///"
    if url.startswith(prefix) and url != "sqlite:///:memory:":
        raw_path = url[len(prefix):]
        if not Path(raw_path).is_absolute():
            return f"{prefix}{(BACKEND_DIR / raw_path).resolve().as_posix()}"
    return url


class Settings:
    def __init__(self) -> None:
        # "production" turns off the API docs and demo login (unless explicitly enabled), sends
        # HSTS, and refuses to start with unsafe settings. The Docker image sets it.
        self.environment: str = (os.getenv("APP_ENV") or "development").strip().lower()
        self.database_url: str = _resolve_database_url(os.getenv("DATABASE_URL"))
        self.secret_key: str | None = os.getenv("SECRET_KEY") or None
        self.access_token_expire_minutes: int = _env_int("ACCESS_TOKEN_EXPIRE_MINUTES", 60 * 24)
        self.google_client_id: str | None = os.getenv("GOOGLE_CLIENT_ID") or None
        # Optional: raises GitHub's API limit from 60 to 5,000 requests per hour.
        self.github_token: str | None = os.getenv("GITHUB_TOKEN") or None

        self.gemini_api_key: str | None = os.getenv("GEMINI_API_KEY") or None
        self.gemini_model: str = os.getenv("GEMINI_MODEL") or "gemini-3.6-flash"
        self.gemini_fallback_model: str = os.getenv("GEMINI_FALLBACK_MODEL") or "gemini-flash-latest"
        self.gemini_timeout_seconds: int = _env_int("GEMINI_TIMEOUT_SECONDS", 30)

        origins = os.getenv("CORS_ORIGINS")
        self.cors_origins: list[str] = (
            [o.strip() for o in origins.split(",") if o.strip()] if origins else list(DEFAULT_CORS_ORIGINS)
        )
        self.demo_login_enabled: bool = _env_bool("DEMO_LOGIN_ENABLED", not self.is_production)
        self.docs_enabled: bool = _env_bool("ENABLE_API_DOCS", not self.is_production)
        self.rate_limits_enabled: bool = _env_bool("RATE_LIMITS_ENABLED", True)
        self.max_resume_bytes: int = _env_int("MAX_RESUME_MB", 10) * 1024 * 1024
        # Video interviews upload each answer's audio (16 kHz WAV is about 2 MB a minute).
        self.max_answer_audio_bytes: int = _env_int("MAX_ANSWER_AUDIO_MB", 16) * 1024 * 1024
        # Any request body above this is refused before it is read: the largest upload plus
        # room for a whiteboard image (4 MB) and form fields.
        self.max_request_bytes: int = max(self.max_resume_bytes, self.max_answer_audio_bytes) + 6 * 1024 * 1024
        self.static_dir: Path = Path(os.getenv("STATIC_DIR") or (BACKEND_DIR / "static"))
        self.run_migrations_on_startup: bool = _env_bool("RUN_MIGRATIONS_ON_STARTUP", True)

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    def problems(self) -> list[str]:
        """Settings that make the app unsafe to run. Startup fails if any are found."""
        found = []
        if self.environment not in ("development", "production"):
            found.append(f'APP_ENV must be "development" or "production", not "{self.environment}".')
        if not self.secret_key:
            found.append("SECRET_KEY is not set. Generate one with: "
                         "python -c \"import secrets; print(secrets.token_urlsafe(48))\"")
        elif self.is_production and len(self.secret_key) < 32:
            found.append("SECRET_KEY must be at least 32 characters in production.")
        if any(origin.strip() == "*" for origin in self.cors_origins):
            found.append("CORS_ORIGINS cannot be \"*\". List the exact frontend origins, separated by commas.")
        if self.is_production and any(o.startswith("http://") and "localhost" not in o and "127.0.0.1" not in o
                                      for o in self.cors_origins):
            found.append("CORS_ORIGINS must use https:// in production (except localhost).")
        return found


settings = Settings()
