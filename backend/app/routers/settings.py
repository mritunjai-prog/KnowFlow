from fastapi import APIRouter, Request

from app.catalog import KNOWN_SOURCES
from app.deps import csrf_ok, load_actor, origin_ok
from app.errors import error_response
from app.identity import issue_email_token, model_allowed, settings_out
from app.security import normalize_email, utcnow
from app.schemas import SettingsOut

router = APIRouter()


@router.get("/settings")
def get_settings(request: Request):
    actor = load_actor(request, request.state.db)
    if actor.user is None:
        return error_response(401, "SESSION_REQUIRED", "Sign in before continuing.", request)
    return settings_out(actor.user)


@router.patch("/settings")
def patch_settings(body: SettingsOut, request: Request):
    db = request.state.db
    settings = request.app.state.settings
    if not origin_ok(request, settings):
        return error_response(403, "ORIGIN_REJECTED", "This origin is not allowed.", request)
    actor = load_actor(request, db)
    if actor.user is None or actor.record is None:
        return error_response(401, "SESSION_REQUIRED", "Sign in before continuing.", request)
    if not csrf_ok(request, actor.record):
        return error_response(403, "CSRF_FAILED", "The security token is missing or expired. Reload and try again.", request)
    name = body.name.strip()
    if not name or len(name) > 100:
        return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request, {"name": "Name must be 1–100 characters."})
    if body.captureSource not in KNOWN_SOURCES:
        return error_response(
            422,
            "VALIDATION_ERROR",
            "The request is invalid.",
            request,
            {"captureSource": "Choose a known capture source."},
        )
    if not model_allowed(body.modelId, request.app.state.transcriber.configured):
        return error_response(
            422,
            "VALIDATION_ERROR",
            "That model is not configured.",
            request,
            {"modelId": "Choose a configured model or leave it unset."},
        )
    user = actor.user
    user.name = name
    user.capture_source = body.captureSource
    user.model_id = body.modelId
    user.updated_at = utcnow()
    requested = normalize_email(str(body.email))
    if requested != user.email:
        issue_email_token(db, settings, user, "email_change", requested)
    return settings_out(user)
