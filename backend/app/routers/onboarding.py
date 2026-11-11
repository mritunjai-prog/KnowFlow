from fastapi import APIRouter, Request

from app.deps import csrf_ok, load_actor, origin_ok
from app.errors import error_response
from app.identity import issue_csrf, session_out
from app.schemas import OnboardingInput
from app.security import utcnow

router = APIRouter()


@router.patch("/onboarding")
def complete_onboarding(body: OnboardingInput, request: Request):
    settings = request.app.state.settings
    if not origin_ok(request, settings):
        return error_response(403, "ORIGIN_REJECTED", "This origin is not allowed.", request)
    actor = load_actor(request, request.state.db)
    if actor.user is None or actor.record is None:
        return error_response(401, "SESSION_REQUIRED", "Sign in before continuing.", request)
    if not csrf_ok(request, actor.record):
        return error_response(403, "CSRF_FAILED", "The security token is missing or expired. Reload and try again.", request)
    if body.complete is not True:
        return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request, {"complete": "Completion must be true."})
    actor.user.onboarding_complete = True
    actor.user.updated_at = utcnow()
    csrf = issue_csrf(actor.record)
    return session_out(actor.user, csrf)
