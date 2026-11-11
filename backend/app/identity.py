import logging
from datetime import timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.catalog import available_model_ids
from app.config import Settings
from app.models import AuthSession, EmailToken, User
from app.schemas import SessionOut, SettingsOut, UserOut
from app.security import (
    absolute_deadline,
    aware,
    digest,
    hash_password,
    idle_deadline,
    new_id,
    new_secret,
    normalize_email,
    utcnow,
    verify_password,
)

verification_log = logging.getLogger("knowflow.verification")
GENERIC_VERIFICATION = (
    "Check the server log for the verification link, then confirm it before signing in."
)


def user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        name=user.name,
        email=user.email,
        role="admin" if user.role == "admin" else "user",
        onboardingComplete=user.onboarding_complete,
    )


def session_out(user: User | None, csrf: str) -> SessionOut:
    return SessionOut(user=user_out(user) if user else None, csrfToken=csrf)


def settings_out(user: User) -> SettingsOut:
    return SettingsOut(
        name=user.name,
        email=user.email,
        captureSource=user.capture_source,
        modelId=user.model_id,
    )


def issue_csrf(record: AuthSession) -> str:
    token = new_secret()
    record.csrf_hash = digest(token)
    return token


def create_anonymous_session(db: Session, settings: Settings) -> tuple[AuthSession, str, str]:
    now = utcnow()
    cookie = new_secret()
    csrf = new_secret()
    record = AuthSession(
        id=new_id(),
        token_hash=digest(cookie),
        user_id=None,
        csrf_hash=digest(csrf),
        created_at=now,
        last_seen_at=now,
        expires_at=absolute_deadline(settings, now),
        idle_expires_at=idle_deadline(settings, now),
    )
    db.add(record)
    db.flush()
    return record, cookie, csrf


def touch(record: AuthSession, settings: Settings) -> None:
    now = utcnow()
    record.last_seen_at = now
    record.idle_expires_at = idle_deadline(settings, now)


def session_is_live(record: AuthSession) -> bool:
    now = utcnow()
    if record.revoked_at is not None:
        return False
    return aware(record.expires_at) > now and aware(record.idle_expires_at) > now


def load_session(db: Session, cookie: str | None) -> AuthSession | None:
    if not cookie:
        return None
    return db.scalar(select(AuthSession).where(AuthSession.token_hash == digest(cookie)))


def bind_user_session(db: Session, settings: Settings, user: User) -> tuple[AuthSession, str, str]:
    record, cookie, csrf = create_anonymous_session(db, settings)
    record.user_id = user.id
    return record, cookie, csrf


def revoke(record: AuthSession) -> None:
    record.revoked_at = utcnow()


def revoke_other_sessions(db: Session, user_id: str, keep_id: str | None) -> None:
    now = utcnow()
    rows = db.scalars(select(AuthSession).where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None)))
    for row in rows:
        if keep_id is None or row.id != keep_id:
            row.revoked_at = now


def find_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == normalize_email(email)))


def promote_configured_admins(db: Session, settings: Settings) -> None:
    allowed = settings.admin_email_set
    if not allowed:
        return
    users = db.scalars(select(User).where(User.email.in_(allowed), User.email_verified_at.is_not(None)))
    for user in users:
        user.role = "admin"


def _log_token(purpose: str, email: str, token: str, expires_at) -> None:
    line = (
        "KNOWFLOW_EMAIL_VERIFICATION "
        f"purpose={purpose} email={email} token={token} expires_at={expires_at.isoformat()} "
        "confirm=POST /api/v1/auth/email-verifications/confirm"
    )
    print(line, flush=True)
    verification_log.info(line)


def issue_email_token(db: Session, settings: Settings, user: User, purpose: str, new_email: str | None = None) -> str:
    now = utcnow()
    db.execute(
        delete(EmailToken).where(
            EmailToken.user_id == user.id,
            EmailToken.purpose == purpose,
            EmailToken.consumed_at.is_(None),
        )
    )
    token = new_secret()
    expires = now + timedelta(seconds=settings.verification_ttl_seconds)
    db.add(
        EmailToken(
            id=new_id(),
            user_id=user.id,
            purpose=purpose,
            token_hash=digest(token),
            new_email=new_email,
            expires_at=expires,
            created_at=now,
        )
    )
    db.flush()
    _log_token(purpose, new_email or user.email, token, expires)
    return token


def register_user(db: Session, settings: Settings, name: str, email: str, password: str) -> None:
    """Create or refresh an unverified account. Never returns a usable session."""
    normalized = normalize_email(email)
    cleaned = name.strip()
    hashed = hash_password(password)
    existing = find_user_by_email(db, normalized)
    if existing and existing.email_verified_at is not None:
        return
    if existing:
        existing.name = cleaned
        existing.password_hash = hashed
        existing.updated_at = utcnow()
        issue_email_token(db, settings, existing, "registration")
        return
    now = utcnow()
    user = User(
        id=new_id(),
        name=cleaned,
        email=normalized,
        password_hash=hashed,
        role="user",
        onboarding_complete=False,
        email_verified_at=None,
        capture_source="file",
        model_id=None,
        created_at=now,
        updated_at=now,
    )
    db.add(user)
    db.flush()
    issue_email_token(db, settings, user, "registration")


def confirm_registration(db: Session, settings: Settings, token: str, password: str) -> str | None:
    """Activate a pending account. Returns an error code, or None on success. Does not log in."""
    row = db.scalar(select(EmailToken).where(EmailToken.token_hash == digest(token)))
    if row is None or row.purpose != "registration" or row.consumed_at is not None or aware(row.expires_at) <= utcnow():
        return "invalid"
    user = db.get(User, row.user_id)
    if user is None or user.email_verified_at is not None:
        return "invalid"
    if not verify_password(password, user.password_hash):
        return "password"
    now = utcnow()
    user.email_verified_at = now
    user.updated_at = now
    row.consumed_at = now
    if user.email in settings.admin_email_set:
        user.role = "admin"
    return None


def authenticate(db: Session, email: str, password: str) -> tuple[User | None, str | None]:
    user = find_user_by_email(db, email)
    if user is None:
        hash_password(password)
        return None, "invalid"
    if not verify_password(password, user.password_hash):
        return None, "invalid"
    if user.email_verified_at is None:
        return user, "unverified"
    return user, None


def model_allowed(model_id: str | None, vision: bool = False) -> bool:
    return model_id is None or model_id in available_model_ids(vision)
