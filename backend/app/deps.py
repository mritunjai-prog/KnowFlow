from dataclasses import dataclass

from fastapi import Request
from sqlalchemy.orm import Session

from app.config import Settings
from app.errors import error_response
from app.identity import load_session, session_is_live
from app.models import AuthSession, User
from app.security import COOKIE, digest


@dataclass
class Actor:
    record: AuthSession | None
    user: User | None
    cookie: str | None


def client_ip(request: Request) -> str:
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def load_actor(request: Request, db: Session) -> Actor:
    cookie = request.cookies.get(COOKIE)
    record = load_session(db, cookie)
    if record is None or not session_is_live(record):
        return Actor(None, None, cookie)
    user = db.get(User, record.user_id) if record.user_id else None
    if record.user_id and (user is None or user.email_verified_at is None):
        return Actor(None, None, cookie)
    return Actor(record, user, cookie)


def origin_ok(request: Request, settings: Settings) -> bool:
    origin = request.headers.get("origin")
    if not origin:
        return False
    return origin.rstrip("/") in settings.origins


def csrf_ok(request: Request, record: AuthSession | None) -> bool:
    if record is None:
        return False
    presented = request.headers.get("x-csrf-token") or ""
    if not presented:
        return False
    return digest(presented) == record.csrf_hash


def reject(status: int, code: str, message: str, request: Request, fields: dict[str, str] | None = None, headers=None):
    return error_response(status, code, message, request, fields, headers)


def reader(request: Request):
    actor = load_actor(request, request.state.db)
    if actor.user is None:
        return None, error_response(401, "SESSION_REQUIRED", "Sign in before continuing.", request)
    return actor, None


def mutation_actor(request: Request):
    settings: Settings = request.app.state.settings
    if not origin_ok(request, settings):
        return None, error_response(403, "ORIGIN_REJECTED", "This origin is not allowed.", request)
    actor = load_actor(request, request.state.db)
    if not csrf_ok(request, actor.record):
        return None, error_response(403, "CSRF_FAILED", "The security token is missing or expired. Reload and try again.", request)
    if actor.user is None:
        return None, error_response(401, "SESSION_REQUIRED", "Sign in before continuing.", request)
    return actor, None
