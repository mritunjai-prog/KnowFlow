"""Start, pause, resume, and stop. The client cannot submit elapsed time."""

import hashlib
import json
from datetime import datetime

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.analytics import parse_zone, window_for
from app.deps import mutation_actor, reader
from app.errors import error_response
from app.models import StudyIdempotency
from app.schemas import StudyRevisionIn, StudyStartIn
from app.security import new_id, utcnow
from app import study
from sqlalchemy import select

router = APIRouter()


def _hash(operation: str, body: dict) -> str:
    payload = json.dumps({"op": operation, "body": body}, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode()).hexdigest()


def _denied(request: Request, exc: study.StudyDenied):
    return error_response(exc.status, exc.code, exc.message, request, exc.fields)


def _mutate(request: Request, operation: str, body: dict, apply):
    actor, denied = mutation_actor(request)
    if denied:
        return denied
    key = request.headers.get("idempotency-key", "").strip()
    if not key or len(key) > 200:
        return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request, {"idempotencyKey": "An Idempotency-Key is required."})
    db = request.state.db
    digest = _hash(operation, body)
    existing = db.scalar(select(StudyIdempotency).where(StudyIdempotency.user_id == actor.user.id, StudyIdempotency.idem_key == key))
    if existing is not None:
        if existing.payload_hash != digest:
            return error_response(409, "IDEMPOTENCY_CONFLICT", "This Idempotency-Key was already used for a different request.", request)
        return JSONResponse(json.loads(existing.body_json), status_code=existing.status_code)
    try:
        status, payload = apply(db, actor.user)
    except study.StudyDenied as exc:
        return _denied(request, exc)
    db.add(
        StudyIdempotency(
            id=new_id(),
            user_id=actor.user.id,
            idem_key=key,
            payload_hash=digest,
            status_code=status,
            body_json=json.dumps(payload),
            created_at=utcnow(),
        )
    )
    db.flush()
    return JSONResponse(payload, status_code=status)


@router.get("/study-sessions/current")
def current_session(request: Request):
    actor, denied = reader(request)
    if denied:
        return denied
    return study.current_state(request.state.db, actor.user)


@router.post("/study-sessions")
async def start_session(request: Request):
    raw = await request.body()
    if raw:
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request)
        try:
            body = StudyStartIn.model_validate(payload)
        except ValidationError:
            return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request, {"body": "Start accepts only an optional documentId."})
    else:
        body = StudyStartIn()
    recorded = {"documentId": body.documentId}
    return _mutate(request, "start", recorded, lambda db, user: study.start(db, user, body.documentId))


@router.post("/study-sessions/{session_id}/heartbeat")
async def heartbeat(session_id: str, request: Request):
    body, failed = await _read_revision(request)
    if failed:
        return failed
    return _mutate(
        request,
        f"heartbeat:{session_id}",
        {"revision": body.revision},
        lambda db, user: study.heartbeat(db, user, session_id, body.revision),
    )


@router.post("/study-sessions/{session_id}/pause")
async def pause(session_id: str, request: Request):
    body, failed = await _read_revision(request)
    if failed:
        return failed
    return _mutate(
        request,
        f"pause:{session_id}",
        {"revision": body.revision},
        lambda db, user: study.pause(db, user, session_id, body.revision),
    )


@router.post("/study-sessions/{session_id}/resume")
async def resume(session_id: str, request: Request):
    body, failed = await _read_revision(request)
    if failed:
        return failed
    return _mutate(
        request,
        f"resume:{session_id}",
        {"revision": body.revision},
        lambda db, user: study.resume(db, user, session_id, body.revision),
    )


@router.post("/study-sessions/{session_id}/stop")
async def stop(session_id: str, request: Request):
    body, failed = await _read_revision(request)
    if failed:
        return failed
    return _mutate(
        request,
        f"stop:{session_id}",
        {"revision": body.revision},
        lambda db, user: study.stop(db, user, session_id, body.revision),
    )


@router.get("/study-sessions")
def list_sessions(request: Request, page: int = 1, pageSize: int = 20):
    actor, denied = reader(request)
    if denied:
        return denied
    if page < 1 or pageSize < 1 or pageSize > 100:
        return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request)
    start = request.query_params.get("from")
    end = request.query_params.get("to")
    zone_name = (request.query_params.get("timezone") or "UTC").strip() or "UTC"
    zone = parse_zone(zone_name)
    if zone is None:
        return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request, {"timezone": "Use an IANA timezone."})
    window = None
    if start or end:
        if not start or not end:
            return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request, {"from": "Provide both from and to as YYYY-MM-DD."})
        try:
            start_day = datetime.fromisoformat(start).date()
            end_day = datetime.fromisoformat(end).date()
        except ValueError:
            return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request, {"from": "Use YYYY-MM-DD."})
        if end_day < start_day:
            return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request, {"to": "The end date is before the start date."})
        window = window_for(start_day, end_day, zone)
    return study.history(request.state.db, actor.user, window, page, pageSize)


@router.delete("/study-sessions/{session_id}")
def delete_session(session_id: str, request: Request):
    actor, denied = mutation_actor(request)
    if denied:
        return denied
    presented = request.headers.get("if-match", "").strip().strip('"')
    if not presented.isdigit():
        return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request, {"ifMatch": "Send the session revision in If-Match."})
    try:
        study.remove(request.state.db, actor.user, session_id, int(presented))
    except study.StudyDenied as exc:
        return _denied(request, exc)
    return Response(status_code=204)


async def _read_revision(request: Request) -> tuple[StudyRevisionIn | None, JSONResponse | None]:
    try:
        payload = await request.json()
    except Exception:
        return None, error_response(422, "VALIDATION_ERROR", "The request is invalid.", request)
    try:
        return StudyRevisionIn.model_validate(payload), None
    except ValidationError:
        return None, error_response(
            422,
            "VALIDATION_ERROR",
            "The request is invalid.",
            request,
            {"body": "Send the session revision. Elapsed time is not accepted."},
        )
