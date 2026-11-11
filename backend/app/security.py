import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Response

from app.config import Settings

COOKIE = "knowflow_session"
_hasher = PasswordHasher(time_cost=2, memory_cost=65536, parallelism=1)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def new_id() -> str:
    return secrets.token_urlsafe(18)


def new_secret() -> str:
    return secrets.token_urlsafe(32)


def digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return _hasher.verify(hashed, password)
    except VerifyMismatchError:
        return False
    except Exception:
        return False


def normalize_email(value: str) -> str:
    return value.strip().lower()


def set_session_cookie(response: Response, token: str, expires_at: datetime, settings: Settings) -> None:
    remaining = max(1, int((aware(expires_at) - utcnow()).total_seconds()))
    response.set_cookie(
        key=COOKIE,
        value=token,
        max_age=remaining,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        key=COOKIE,
        path="/",
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
    )


def idle_deadline(settings: Settings, now: datetime | None = None) -> datetime:
    return (now or utcnow()) + timedelta(seconds=settings.session_idle_seconds)


def absolute_deadline(settings: Settings, now: datetime | None = None) -> datetime:
    return (now or utcnow()) + timedelta(seconds=settings.session_absolute_seconds)
