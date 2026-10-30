import hashlib
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import func
from sqlalchemy.orm import Session

from core import database, models
from core.config import settings

logger = logging.getLogger(__name__)

ALGORITHM = "HS256"
BCRYPT_ROUNDS = 12

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def _secret_key() -> str:
    if not settings.secret_key:
        raise RuntimeError("SECRET_KEY is not set")
    return settings.secret_key


def _prehash(password: str) -> bytes:
    # bcrypt only reads the first 72 bytes; a SHA-256 hex digest (64 bytes) lets every character count.
    return hashlib.sha256(password.encode()).hexdigest().encode()


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(_prehash(password), bcrypt.gensalt(rounds=BCRYPT_ROUNDS)).decode()


# Compared against when an account has no usable hash, so a login takes the same time whether
# or not the email exists. Without it, response times reveal which emails have accounts.
_DUMMY_HASH = get_password_hash("timing-equaliser-not-a-real-password")


def verify_password(plain_password: str, hashed_password: Optional[str]) -> bool:
    """False for accounts without a usable password hash (Google or demo sign-ins). Always does the
    full bcrypt work, so the time taken does not depend on whether the account exists."""
    candidate = hashed_password if hashed_password and hashed_password.startswith("$2") else None
    try:
        matched = bcrypt.checkpw(_prehash(plain_password), (candidate or _DUMMY_HASH).encode())
    except ValueError:  # malformed stored hash
        bcrypt.checkpw(_prehash(plain_password), _DUMMY_HASH.encode())
        return False
    return matched and candidate is not None


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    to_encode.update({"exp": expire, "iat": now})
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
        # The algorithm list is fixed, so a token cannot choose a weaker one (such as "none").
        payload = jwt.decode(token, _secret_key(), algorithms=[ALGORITHM], options={"require": ["exp", "sub"]})
    except jwt.PyJWTError:
        raise credentials_exception
    email = payload.get("sub")
    if not isinstance(email, str) or not email:
        raise credentials_exception

    user = get_user_by_email(db, email)
    if user is None:
        raise credentials_exception
    return user
