import hashlib
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from passlib.exc import UnknownHashError
from sqlalchemy import func
from sqlalchemy.orm import Session

from core import database, models
from core.config import settings

logger = logging.getLogger(__name__)

ALGORITHM = "HS256"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def _secret_key() -> str:
    if not settings.secret_key:
        raise RuntimeError("SECRET_KEY is not set")
    return settings.secret_key


def verify_password(plain_password: str, hashed_password: Optional[str]) -> bool:
    """False for accounts without a usable password hash (Google or demo sign-ins)."""
    if not hashed_password:
        return False
    # Pre-hash for bcrypt 72 char limit compatibility
    password_hash = hashlib.sha256(plain_password.encode()).hexdigest()
    try:
        return pwd_context.verify(password_hash, hashed_password)
    except (UnknownHashError, ValueError):
        return False

def get_password_hash(password: str) -> str:
    # Pre-hash for bcrypt 72 char limit compatibility
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    return pwd_context.hash(password_hash)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, _secret_key(), algorithm=ALGORITHM)

def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    return db.query(models.User).filter(func.lower(models.User.email) == email.strip().lower()).first()

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, _secret_key(), algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = get_user_by_email(db, email)
    if user is None:
        raise credentials_exception
    return user
