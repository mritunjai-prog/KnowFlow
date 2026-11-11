import json

from fastapi import APIRouter, Request
from sqlalchemy import func, select

from app.catalog import DEFAULT_STORAGE_LIMIT, KNOWN_SOURCES, MAX_SAFE_INTEGER, available_model_ids
from app.deps import csrf_ok, load_actor, origin_ok
from app.errors import error_response
from app.models import Document, Job, ServiceConfig
from app.schemas import AdminConfigOut, AdminStatusOut, ServiceHealth

router = APIRouter()


def _admin(request: Request):
    actor = load_actor(request, request.state.db)
    if actor.user is None:
        return None, error_response(401, "SESSION_REQUIRED", "Sign in before continuing.", request)
    if actor.user.role != "admin":
        return None, error_response(403, "FORBIDDEN", "Admin access is required.", request)
    return actor, None


def _config(db) -> ServiceConfig:
    row = db.scalar(select(ServiceConfig).where(ServiceConfig.id == 1))
    if row is None:
        row = ServiceConfig(
            id=1,
            storage_limit_bytes=DEFAULT_STORAGE_LIMIT,
            default_model_id=None,
            capture_sources=json.dumps(list(KNOWN_SOURCES)),
        )
        db.add(row)
        db.flush()
    return row


def _config_out(row: ServiceConfig) -> AdminConfigOut:
    return AdminConfigOut(
        storageLimitBytes=row.storage_limit_bytes,
        defaultModelId=row.default_model_id,
        captureSources=json.loads(row.capture_sources),
    )


@router.get("/admin/config")
def get_config(request: Request):
    _actor, denied = _admin(request)
    if denied:
        return denied
    return _config_out(_config(request.state.db))


@router.patch("/admin/config")
def patch_config(body: AdminConfigOut, request: Request):
    settings = request.app.state.settings
    if not origin_ok(request, settings):
        return error_response(403, "ORIGIN_REJECTED", "This origin is not allowed.", request)
    actor, denied = _admin(request)
    if denied:
        return denied
    if not csrf_ok(request, actor.record):
        return error_response(403, "CSRF_FAILED", "The security token is missing or expired. Reload and try again.", request)
    if (
        not isinstance(body.storageLimitBytes, int)
        or isinstance(body.storageLimitBytes, bool)
        or body.storageLimitBytes <= 0
        or body.storageLimitBytes > MAX_SAFE_INTEGER
    ):
        return error_response(
            422,
            "VALIDATION_ERROR",
            "The request is invalid.",
            request,
            {"storageLimitBytes": "Enter a positive storage limit."},
        )
    unknown = [item for item in body.captureSources if item not in KNOWN_SOURCES]
    if unknown or len(set(body.captureSources)) != len(body.captureSources):
        return error_response(
            422,
            "VALIDATION_ERROR",
            "The request is invalid.",
            request,
            {"captureSources": "Choose a subset of file, camera, text, and audio."},
        )
    if body.defaultModelId is not None and body.defaultModelId not in available_model_ids(request.app.state.transcriber.configured):
        return error_response(
            422,
            "VALIDATION_ERROR",
            "That model is not configured.",
            request,
            {"defaultModelId": "Choose a configured model or leave it unset."},
        )
    row = _config(request.state.db)
    row.storage_limit_bytes = body.storageLimitBytes
    row.default_model_id = body.defaultModelId
    row.capture_sources = json.dumps(body.captureSources)
    return _config_out(row)


@router.get("/admin/status")
def get_status(request: Request):
    _actor, denied = _admin(request)
    if denied:
        return denied
    db = request.state.db
    used = db.scalar(select(func.coalesce(func.sum(Document.storage_bytes), 0))) or 0
    documents = db.scalar(select(func.count()).select_from(Document)) or 0
    queued = db.scalar(select(func.count()).select_from(Job).where(Job.status.in_(("queued", "running")))) or 0
    failed = db.scalar(select(func.count()).select_from(Job).where(Job.status == "failed")) or 0
    return AdminStatusOut(
        storageUsedBytes=int(used),
        documentCount=int(documents),
        queuedJobs=int(queued),
        failedJobs=int(failed),
        services=[
            ServiceHealth(name="database", status="ready", message="The application database accepted a status query."),
            ServiceHealth(name="object-storage", status="unavailable", message="Object storage is not connected in this milestone."),
            ServiceHealth(name="processing", status="unavailable", message="Document and model processing are not enabled."),
        ],
    )
