import hashlib
import json
from datetime import datetime

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import Response
from sqlalchemy import func, select

from app.catalog import (
    ACCEPTED_IMAGES,
    DOCUMENT_TYPES,
    MAX_BATCH_FILES,
    MAX_FILE_BYTES,
    MAX_TEXT_CHARACTERS,
)
from app.deps import mutation_actor, reader
from app.errors import error_response
from app.extract import ParseError, detect_media
from app.models import Document, IdempotencyRecord, Job, JobItem, Meeting, ServiceConfig
from app.pipeline import advance, items_for
from app.rate_limit import hit
from app.schemas import JobItemOut, JobOut
from app.security import new_id, utcnow
from app.storage import StorageError

router = APIRouter()


def job_out(db, job: Job) -> JobOut:
    rows = items_for(db, job.id)
    return JobOut(
        id=job.id,
        status=job.status if job.status in {"queued", "running", "succeeded", "failed", "cancelled"} else "failed",
        stage=job.stage,
        progress=job.progress,
        items=[
            JobItemOut(name=row.name, status=row.status if row.status != "cancelled" else "failed", documentId=row.document_id, error=row.error)
            for row in rows
        ],
        error=job.error,
        retryable=job.retryable,
        meetingId=job.meeting_id,
    )


def _meta(raw: str) -> dict | None:
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(value, dict):
        return None
    required = {"title", "tags", "documentType", "meetingId", "meetingTitle", "occurredAt", "captureSource", "modelId"}
    if not required.issubset(value) or set(value) - required:
        return None
    return value


@router.post("/ingestions", status_code=202)
async def ingest(
    request: Request,
    text: str = Form(""),
    metadata: str = Form(""),
    files: list[UploadFile] | None = File(default=None),
):
    actor, denied = mutation_actor(request)
    if denied:
        return denied
    db = request.state.db
    settings = request.app.state.settings
    limited = hit(db, settings, f"ingest:{actor.user.id}", limit=30)
    if limited:
        return error_response(429, "RATE_LIMITED", "Too many attempts. Wait before trying again.", request, headers={"Retry-After": str(limited)})
    key = request.headers.get("idempotency-key", "").strip()
    if not key or len(key) > 200:
        return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request, {"idempotencyKey": "An Idempotency-Key is required."})
    parsed = _meta(metadata)
    if parsed is None:
        return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request, {"metadata": "Metadata must match the ingestion contract."})
    title = str(parsed["title"]).strip()
    if not title or len(title) > 200:
        return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request, {"title": "Title must be 1–200 characters."})
    if parsed["documentType"] is not None and parsed["documentType"] not in DOCUMENT_TYPES:
        return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request, {"documentType": "Choose a known document type."})
    tags = parsed["tags"] if isinstance(parsed["tags"], list) else None
    if tags is None or any(not isinstance(item, str) for item in tags) or len(tags) > 20:
        return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request, {"tags": "Tags must be a short list of text."})
    cleaned_text = text.strip()
    uploads = files or []
    if len(uploads) > MAX_BATCH_FILES:
        return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request, {"files": "Too many files."})
    if not uploads and not cleaned_text:
        return error_response(422, "VALIDATION_ERROR", "Add a file or some text before processing.", request)
    if len(cleaned_text) > MAX_TEXT_CHARACTERS:
        return error_response(413, "PAYLOAD_TOO_LARGE", "The text is longer than the configured limit.", request)
    bodies: list[tuple[str, bytes, str | None]] = []
    for upload in uploads:
        data = await upload.read()
        if len(data) > MAX_FILE_BYTES:
            return error_response(413, "PAYLOAD_TOO_LARGE", "A file exceeds the size limit.", request)
        try:
            media = detect_media(data, upload.filename or "")
        except ParseError:
            media = None
        bodies.append((upload.filename or "upload", data, media))
    payload_hash = hashlib.sha256(
        json.dumps({"text": cleaned_text, "metadata": parsed, "files": [hashlib.sha256(item[1]).hexdigest() for item in bodies]}, sort_keys=True).encode()
    ).hexdigest()
    existing = db.scalar(select(IdempotencyRecord).where(IdempotencyRecord.user_id == actor.user.id, IdempotencyRecord.idem_key == key))
    if existing:
        if existing.payload_hash != payload_hash:
            return error_response(409, "IDEMPOTENCY_CONFLICT", "This Idempotency-Key was already used for a different request.", request)
        job = db.get(Job, existing.job_id)
        return job_out(db, job)
    meeting, meeting_error = _meeting(db, actor.user.id, parsed)
    if meeting_error:
        return error_response(meeting_error[0], meeting_error[1], meeting_error[2], request)
    config = db.get(ServiceConfig, 1)
    used = db.scalar(select(func.coalesce(func.sum(Document.storage_bytes), 0))) or 0
    incoming = sum(len(item[1]) for item in bodies)
    if config and int(used) + incoming > config.storage_limit_bytes:
        return error_response(413, "PAYLOAD_TOO_LARGE", "The storage limit has been reached.", request)
    now = utcnow()
    job = Job(
        id=new_id(),
        owner_id=actor.user.id,
        status="queued",
        created_at=now,
        updated_at=now,
        stage="Waiting for the next processing step.",
        progress=0,
        error=None,
        retryable=False,
        meeting_id=meeting.id if meeting else None,
        payload_json=json.dumps(
            {
                "title": title,
                "documentType": parsed["documentType"] or "other",
                "tags": [item.strip() for item in tags if item.strip()],
                "many": len(bodies) + (1 if cleaned_text else 0) > 1,
            }
        ),
    )
    db.add(job)
    db.flush()
    position = 0
    if cleaned_text:
        db.add(
            JobItem(
                id=new_id(),
                job_id=job.id,
                position=position,
                name=title,
                status="queued",
                kind="text",
                text_payload=cleaned_text,
                step="extract",
                partial_text="",
            )
        )
        position += 1
    store = request.app.state.store
    for name, data, media in bodies:
        item_id = new_id()
        item = JobItem(
            id=item_id,
            job_id=job.id,
            position=position,
            name=name[:180] or "upload",
            status="queued",
            kind="file",
            media_type=media,
            step="extract",
            partial_text="",
        )
        if not data:
            item.status = "failed"
            item.error = "The file is empty."
            item.step = "done"
        elif media is None:
            item.status = "failed"
            item.error = "The file type is not supported or does not match its contents."
            item.step = "done"
        elif media in ACCEPTED_IMAGES and not request.app.state.transcriber.configured:
            item.status = "failed"
            item.error = "Page transcription is not configured."
            item.step = "done"
        elif media not in ACCEPTED_IMAGES and media not in {"application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}:
            item.status = "failed"
            item.error = "This file type is not supported."
            item.step = "done"
        else:
            object_key = f"q/{job.id}/{item_id}"
            store.put(object_key, data, media)
            item.object_key = object_key
        db.add(item)
        position += 1
    rows = items_for(db, job.id)
    if rows and all(row.status == "failed" for row in rows):
        job.status = "failed"
        job.retryable = True
        job.stage = "Failed."
        job.error = rows[0].error
        job.progress = 100
    db.add(
        IdempotencyRecord(
            id=new_id(),
            user_id=actor.user.id,
            idem_key=key,
            payload_hash=payload_hash,
            job_id=job.id,
            created_at=now,
        )
    )
    db.flush()
    return job_out(db, job)


def _meeting(db, owner_id: str, parsed: dict) -> tuple[Meeting | None, tuple | None]:
    meeting_id = parsed["meetingId"]
    title = parsed["meetingTitle"]
    occurred = parsed["occurredAt"]
    if meeting_id and (title or occurred):
        return None, (422, "VALIDATION_ERROR", "Send either a meeting id or a new meeting, not both.")
    if meeting_id:
        meeting = db.get(Meeting, meeting_id)
        if meeting is None or meeting.owner_id != owner_id:
            return None, (404, "NOT_FOUND", "That meeting is not available.")
        return meeting, None
    if title or occurred:
        if not title or not occurred:
            return None, (422, "VALIDATION_ERROR", "A new meeting needs a title and time.")
        try:
            when = datetime.fromisoformat(str(occurred).replace("Z", "+00:00"))
        except ValueError:
            return None, (422, "VALIDATION_ERROR", "The meeting time is invalid.")
        if when.tzinfo is None:
            return None, (422, "VALIDATION_ERROR", "The meeting time must include a timezone.")
        meeting = Meeting(id=new_id(), owner_id=owner_id, title=str(title)[:200], occurred_at=when, created_at=utcnow())
        db.add(meeting)
        db.flush()
        return meeting, None
    return None, None


@router.get("/jobs/{job_id}")
def get_job(job_id: str, request: Request):
    actor, denied = reader(request)
    if denied:
        return denied
    job = request.state.db.get(Job, job_id)
    if job is None or job.owner_id != actor.user.id:
        return error_response(404, "NOT_FOUND", "That job is not available.", request)
    if job.status in {"queued", "running"} or job.cancel_requested:
        advance(request.state.db, request.app.state.store, request.app.state.transcriber, job)
    return job_out(request.state.db, job)


@router.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: str, request: Request):
    actor, denied = mutation_actor(request)
    if denied:
        return denied
    db = request.state.db
    job = db.get(Job, job_id)
    if job is None or job.owner_id != actor.user.id:
        return error_response(404, "NOT_FOUND", "That job is not available.", request)
    job.cancel_requested = True
    if job.status in {"queued", "failed", "succeeded"} or job.lease_until is None:
        from app.pipeline import _cancel

        _cancel(db, request.app.state.store, job)
    return job_out(db, job)


@router.post("/jobs/{job_id}/retry", status_code=202)
def retry_job(job_id: str, request: Request):
    actor, denied = mutation_actor(request)
    if denied:
        return denied
    db = request.state.db
    job = db.get(Job, job_id)
    if job is None or job.owner_id != actor.user.id:
        return error_response(404, "NOT_FOUND", "That job is not available.", request)
    if job.status == "cancelled" or not job.retryable:
        return error_response(409, "NOT_RETRYABLE", "This job cannot be retried.", request)
    failed = [item for item in items_for(db, job.id) if item.status == "failed"]
    if not failed:
        return error_response(409, "NOT_RETRYABLE", "There is no failed item to retry.", request)
    for item in failed:
        item.status = "queued"
        item.error = None
        item.step = "extract"
        item.page_index = 0
        item.page_count = 0
        item.partial_text = ""
        item.attempts = 0
        item.processed_key = None
        item.thumbnail_key = None
        item.preprocess_note = None
    job.status = "queued"
    job.retryable = False
    job.error = None
    job.stage = "Waiting to retry failed items."
    job.progress = 0
    job.cancel_requested = False
    return job_out(db, job)


@router.get("/files/{token}")
def read_file(token: str, request: Request):
    store = request.app.state.store
    try:
        key, media_type, name = store.read_token(token)
        data, stored_type = store.get(key)
    except StorageError:
        return error_response(404, "NOT_FOUND", "That file is not available.", request)
    safe = name.replace('"', "")[:180] or "file"
    return Response(
        content=data,
        media_type=stored_type or media_type,
        headers={"Content-Disposition": f'inline; filename="{safe}"', "Cache-Control": "private, max-age=60"},
    )
