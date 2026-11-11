"""One database-backed processing step per poll. A restart resumes the stored step."""

import json
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.extract import (
    DOCX,
    ParseError,
    detect_media,
    docx_text,
    pdf_page_count,
    pdf_page_text,
    plain_text,
    render_pdf_page,
)
from app.imaging import ImageError, preprocess
from app.models import Document, Job, JobItem, Meeting, TimelineEvent
from app.security import aware, new_id, utcnow
from app.transcribe import TranscribeError

MAX_TEXT = 100_000
LEASE = timedelta(seconds=20)


def items_for(db: Session, job_id: str) -> list[JobItem]:
    return list(db.scalars(select(JobItem).where(JobItem.job_id == job_id).order_by(JobItem.position, JobItem.id)))


def advance(db: Session, store, transcriber, job: Job) -> None:
    now = utcnow()
    if job.lease_until is not None and aware(job.lease_until) > now and job.status == "running":
        return
    if job.cancel_requested or job.status == "cancelled":
        _cancel(db, store, job)
        return
    if job.status in {"succeeded", "failed"} and not any(item.status in {"queued", "running"} for item in items_for(db, job.id)):
        return
    job.lease_until = now + LEASE
    job.status = "running"
    job.updated_at = now
    db.commit()
    if job.cancel_requested:
        _cancel(db, store, job)
        job.lease_until = None
        db.commit()
        return
    item = next((row for row in items_for(db, job.id) if row.status in {"queued", "running"}), None)
    if item is None:
        _finish(job, items_for(db, job.id))
        job.lease_until = None
        db.commit()
        return
    try:
        _step(db, store, transcriber, job, item)
    except (ParseError, ImageError, TranscribeError) as exc:
        item.status = "failed"
        item.error = str(exc)
        item.step = "done"
        job.retryable = True
        job.stage = str(exc)
    except Exception:
        item.attempts += 1
        if item.attempts >= 3:
            item.status = "failed"
            item.error = "The item could not be processed."
            item.step = "done"
        job.stage = "The last step failed and can be retried."
    _finish(job, items_for(db, job.id))
    job.lease_until = None
    job.updated_at = utcnow()
    db.commit()


def _step(db: Session, store, transcriber, job: Job, item: JobItem) -> None:
    item.status = "running"
    item.attempts += 1
    if item.kind == "text":
        _finish_item(db, store, job, item, item.text_payload or "", "text", None, None, None)
        return
    data, _media = store.get(item.object_key or "")
    if item.media_type == "application/pdf":
        _pdf_step(db, store, transcriber, job, item, data)
        return
    if item.media_type == DOCX:
        _finish_item(db, store, job, item, docx_text(data), "digital", item.object_key, None, None)
        return
    if item.media_type == "text/plain":
        _finish_item(db, store, job, item, plain_text(data, MAX_TEXT), "digital", item.object_key, None, None)
        return
    if item.media_type and item.media_type.startswith("image/"):
        _image_step(db, store, transcriber, job, item, data)
        return
    raise ParseError("This file type is not supported.")


def _pdf_step(db, store, transcriber, job, item, data: bytes) -> None:
    if item.page_count == 0:
        item.page_count = pdf_page_count(data)
        job.stage = "Reading the document text."
        db.commit()
        return
    if item.page_index >= item.page_count:
        source = "digital" if not item.processed_key else "scanned"
        _finish_item(db, store, job, item, item.partial_text.strip(), source, item.object_key, item.processed_key, item.thumbnail_key)
        return
    if item.step == "transcribe":
        jpeg, _media = store.get(item.processed_key or "")
        text = transcriber.transcribe(jpeg)
        item.partial_text = (item.partial_text + "\n" + text).strip()
        item.page_index += 1
        item.step = "extract"
        job.stage = "Reading the next page."
        db.commit()
        return
    text = pdf_page_text(data, item.page_index)
    if text:
        item.partial_text = (item.partial_text + "\n" + text).strip()
        item.page_index += 1
        job.stage = "Reading the document text."
        db.commit()
        return
    rendered = render_pdf_page(data, item.page_index)
    page = preprocess(rendered)
    processed_key = f"p/{item.id}/page-{item.page_index}.jpg"
    thumb_key = f"t/{item.id}/page-{item.page_index}.jpg"
    store.put(processed_key, page.jpeg, "image/jpeg")
    store.put(thumb_key, page.thumbnail, "image/jpeg")
    if item.processed_key is None:
        item.processed_key = processed_key
        item.thumbnail_key = thumb_key
    item.preprocess_note = page.note
    item.step = "transcribe"
    job.stage = page.note or "Transcribing the preprocessed page."
    db.commit()


def _image_step(db, store, transcriber, job, item, data: bytes) -> None:
    if item.step != "transcribe":
        page = preprocess(data)
        item.processed_key = f"p/{item.id}/processed.jpg"
        item.thumbnail_key = f"t/{item.id}/thumb.jpg"
        store.put(item.processed_key, page.jpeg, "image/jpeg")
        store.put(item.thumbnail_key, page.thumbnail, "image/jpeg")
        item.preprocess_note = page.note
        item.step = "transcribe"
        job.stage = page.note or "Detecting the page boundary."
        db.commit()
        return
    jpeg, _media = store.get(item.processed_key or "")
    text = transcriber.transcribe(jpeg)
    _finish_item(db, store, job, item, text, "scanned", item.object_key, item.processed_key, item.thumbnail_key)


def _finish_item(db, store, job, item, text: str, source_type: str, original_key, processed_key, thumbnail_key) -> None:
    cleaned = text.strip()
    if not cleaned:
        raise ParseError("No text could be extracted.")
    if len(cleaned) > MAX_TEXT:
        raise ParseError("The extracted text is longer than the configured limit.")
    title, document_type, tags = _item_metadata(job, item)
    now = utcnow()
    document = Document(
        id=new_id(),
        owner_id=job.owner_id,
        title=title,
        storage_bytes=_stored_size(store, original_key, processed_key, thumbnail_key),
        created_at=now,
        updated_at=now,
        source_type=source_type,
        document_type=document_type,
        tags=json.dumps(tags),
        text=cleaned,
        summary=item.preprocess_note,
        meeting_id=job.meeting_id,
        original_key=original_key,
        original_name=item.name if original_key else None,
        original_type=item.media_type if original_key else None,
        processed_key=processed_key,
        thumbnail_key=thumbnail_key,
        index_state="pending",
    )
    db.add(document)
    meeting = db.get(Meeting, job.meeting_id) if job.meeting_id else None
    db.add(
        TimelineEvent(
            id=new_id(),
            owner_id=job.owner_id,
            document_id=document.id,
            occurred_at=meeting.occurred_at if meeting else now,
            title=title,
            type=document_type,
            excerpt=cleaned[:240],
            page=1 if processed_key else None,
            meeting_id=job.meeting_id,
        )
    )
    item.document_id = document.id
    item.status = "succeeded"
    item.error = None
    item.step = "done"
    item.partial_text = cleaned
    job.stage = "Saving the extracted document."
    db.commit()


def _item_metadata(job: Job, item: JobItem) -> tuple[str, str, list]:
    meta = json.loads(job.payload_json or "{}")
    title = str(meta.get("title") or item.name)[:200]
    if meta.get("many"):
        title = f"{title} — {item.name}"[:200]
    tags = meta.get("tags") if isinstance(meta.get("tags"), list) else []
    return title, str(meta.get("documentType") or "other"), tags


def _stored_size(store, *keys: str | None) -> int:
    total = 0
    for key in keys:
        if key:
            total += store.size(key)
    return total


def _finish(job: Job, rows: list[JobItem]) -> None:
    if job.status == "cancelled":
        job.progress = 100
        return
    done = [row for row in rows if row.status in {"succeeded", "failed"}]
    running = [row for row in rows if row.status in {"queued", "running"}]
    job.progress = int(100 * len(done) / max(1, len(rows)))
    if running:
        job.status = "running"
        job.retryable = False
        return
    if any(row.status == "succeeded" for row in rows):
        job.status = "succeeded"
        job.stage = "Complete."
        job.error = None
        job.retryable = any(row.status == "failed" for row in rows)
        job.progress = 100
        return
    job.status = "failed"
    job.stage = "Failed."
    job.error = next((row.error for row in rows if row.error), "Every item failed.")
    job.retryable = True
    job.progress = 100


def _cancel(db, store, job: Job) -> None:
    for item in items_for(db, job.id):
        if item.status == "succeeded":
            continue
        item.status = "failed"
        item.error = "Cancelled"
        item.step = "done"
        if item.object_key and item.document_id is None:
            store.delete(item.object_key)
    job.status = "cancelled"
    job.cancel_requested = True
    job.retryable = False
    job.stage = "Cancelled. Completed documents were kept."
    job.progress = 100
    job.lease_until = None
    job.updated_at = utcnow()
    db.commit()
