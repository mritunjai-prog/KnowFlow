from fastapi import APIRouter, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import Settings
from app.deps import client_ip, csrf_ok, load_actor, origin_ok
from app.errors import error_response
from app.identity import (
    GENERIC_VERIFICATION,
    authenticate,
    bind_user_session,
    confirm_registration,
    create_anonymous_session,
    find_user_by_email,
    issue_csrf,
    issue_email_token,
    register_user,
    revoke,
    revoke_other_sessions,
    session_out,
)
from app.models import EmailToken
from app.rate_limit import hit
from app.schemas import ConfirmInput, LoginInput, PasswordInput, RegisterInput
from app.security import aware, digest, hash_password, set_session_cookie, utcnow, verify_password

router = APIRouter()


def _guard_mutation(request: Request, db: Session):
    settings: Settings = request.app.state.settings
    if not origin_ok(request, settings):
        return None, error_response(403, "ORIGIN_REJECTED", "This origin is not allowed.", request)
    actor = load_actor(request, db)
    if not csrf_ok(request, actor.record):
        return None, error_response(403, "CSRF_FAILED", "The security token is missing or expired. Reload and try again.", request)
    return actor, None


def _limited(db: Session, request: Request, key: str):
    settings: Settings = request.app.state.settings
    retry = hit(db, settings, key)
    if retry is None:
        return None
    return error_response(
        429,
        "RATE_LIMITED",
        "Too many attempts. Wait before trying again.",
        request,
        headers={"Retry-After": str(retry)},
    )


@router.post("/auth/register", status_code=201)
def register(body: RegisterInput, request: Request, response: Response):
    """Create an unverified account and return the published Session shape.

    The success body is a Session, as required by the frozen contract. The user
    is null: an unverified email is not an authenticated session.
    """
    db: Session = request.state.db
    settings: Settings = request.app.state.settings
    actor, denied = _guard_mutation(request, db)
    if denied:
        return denied
    limited = _limited(db, request, f"register:{client_ip(request)}")
    if limited:
        return limited
    if not body.name.strip():
        return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request, {"name": "Name is required."})
    register_user(db, settings, body.name, str(body.email), body.password)
    if actor.record is not None:
        revoke(actor.record)
    record, cookie, csrf = create_anonymous_session(db, settings)
    set_session_cookie(response, cookie, record.expires_at, settings)
    return session_out(None, csrf)


@router.post("/auth/email-verifications/confirm")
def confirm(body: ConfirmInput, request: Request, response: Response):
    db: Session = request.state.db
    settings: Settings = request.app.state.settings
    actor, denied = _guard_mutation(request, db)
    if denied:
        return denied
    limited = _limited(db, request, f"confirm:{client_ip(request)}")
    if limited:
        return limited
    row = db.scalar(select(EmailToken).where(EmailToken.token_hash == digest(body.token)))
    if row and row.purpose == "email_change":
        return _confirm_email_change(db, settings, request, response, actor, body, row)
    result = confirm_registration(db, settings, body.token, body.password)
    if result == "password":
        return error_response(422, "VALIDATION_ERROR", "The verification details are not valid.", request, {"password": "Password does not match this verification."})
    if result == "invalid":
        return error_response(400, "VERIFICATION_INVALID", "The verification link is invalid or expired.", request)
    if actor.record is None:
        record, cookie, csrf = create_anonymous_session(db, settings)
        set_session_cookie(response, cookie, record.expires_at, settings)
    else:
        csrf = issue_csrf(actor.record)
    return session_out(None, csrf)


def _confirm_email_change(db, settings, request, response, actor, body, row):
    if actor.user is None or actor.user.id != row.user_id:
        return error_response(403, "FORBIDDEN", "This verification does not belong to the current session.", request)
    if row.consumed_at is not None or aware(row.expires_at) <= utcnow():
        return error_response(400, "VERIFICATION_INVALID", "The verification link is invalid or expired.", request)
    if not verify_password(body.password, actor.user.password_hash):
        return error_response(422, "VALIDATION_ERROR", "The verification details are not valid.", request, {"password": "Current password is incorrect."})
    owner = find_user_by_email(db, row.new_email or "")
    if owner and owner.id != actor.user.id:
        return error_response(409, "EMAIL_UNAVAILABLE", "That email cannot be used.", request)
    now = utcnow()
    actor.user.email = row.new_email
    actor.user.updated_at = now
    row.consumed_at = now
    revoke_other_sessions(db, actor.user.id, actor.record.id)
    csrf = issue_csrf(actor.record)
    return session_out(actor.user, csrf)


@router.post("/auth/login")
def login(body: LoginInput, request: Request, response: Response):
    db: Session = request.state.db
    settings: Settings = request.app.state.settings
    actor, denied = _guard_mutation(request, db)
    if denied:
        return denied
    email = str(body.email)
    limited = _limited(db, request, f"login:{email}:{client_ip(request)}")
    if limited:
        return limited
    user, reason = authenticate(db, email, body.password)
    if reason == "unverified" and user is not None:
        issue_email_token(db, settings, user, "registration")
        return error_response(403, "EMAIL_VERIFICATION_REQUIRED", GENERIC_VERIFICATION, request)
    if user is None or reason == "invalid":
        return error_response(401, "INVALID_CREDENTIALS", "The email or password is incorrect.", request)
    if actor.record is not None:
        revoke(actor.record)
    record, cookie, csrf = bind_user_session(db, settings, user)
    set_session_cookie(response, cookie, record.expires_at, settings)
    return session_out(user, csrf)


@router.post("/auth/logout")
def logout(request: Request, response: Response):
    db: Session = request.state.db
    settings: Settings = request.app.state.settings
    actor, denied = _guard_mutation(request, db)
    if denied:
        return denied
    if actor.record is not None:
        revoke(actor.record)
    record, cookie, csrf = create_anonymous_session(db, settings)
    set_session_cookie(response, cookie, record.expires_at, settings)
    return session_out(None, csrf)


@router.put("/auth/password", status_code=204)
def change_password(body: PasswordInput, request: Request):
    db: Session = request.state.db
    actor, denied = _guard_mutation(request, db)
    if denied:
        return denied
    if actor.user is None or actor.record is None:
        return error_response(401, "SESSION_REQUIRED", "Sign in before continuing.", request)
    limited = _limited(db, request, f"password:{actor.user.id}")
    if limited:
        return limited
    if not verify_password(body.currentPassword, actor.user.password_hash):
        return error_response(
            422,
            "VALIDATION_ERROR",
            "The current password is incorrect.",
            request,
            {"currentPassword": "Current password is incorrect."},
        )
    if body.newPassword == body.currentPassword:
        return error_response(
            422,
            "VALIDATION_ERROR",
            "Choose a different password.",
            request,
            {"newPassword": "The new password must be different."},
        )
    actor.user.password_hash = hash_password(body.newPassword)
    actor.user.updated_at = utcnow()
    revoke_other_sessions(db, actor.user.id, actor.record.id)
    db.execute(
        delete(EmailToken).where(
            EmailToken.user_id == actor.user.id,
            EmailToken.purpose == "email_change",
            EmailToken.consumed_at.is_(None),
        )
    )
    return Response(status_code=204)
