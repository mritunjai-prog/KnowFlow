"""One database-backed processing step per poll. A restart resumes the stored step."""

import json
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.catalog import DOCUMENT_TYPES
from app.classify import ClassifyError
from app.embeddings import EmbedError
from app.indexing import embed_next_chunk, sync_chunks
from app.meetings import MeetingError
from app.extract import (
    DOCX,
    ParseError,
    docx_text,
    pdf_page_count,
    pdf_page_text,
    plain_text,
    render_pdf_page,
)
from app.imaging import ImageError, preprocess
from app.models import Document, Job, JobItem, Meeting, PageImage, TimelineEvent
from app.visual import advance_visual
from app.security import aware, new_id, utcnow
from app.tasking import apply_extracted_tasks, stored_actions
from app.transcribe import TranscribeError

MAX_TEXT = 100_000
LEASE = timedelta(seconds=20)


def items_for(db: Session, job_id: str) -> list[JobItem]:
    return list(db.scalars(select(JobItem).where(JobItem.job_id == job_id).order_by(JobItem.position, JobItem.id)))


def advance(db: Session, store, transcriber, classifier, job: Job, embedder=None, generator=None, speech=None, visual=None) -> None:
    job_id = job.id
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
        job = db.get(Job, job_id)
        job.lease_until = None
        db.commit()
        return
    item = next((row for row in items_for(db, job.id) if row.status in {"queued", "running"}), None)
    if item is None:
        job = db.get(Job, job_id)
        _finish(job, items_for(db, job_id))
        job.lease_until = None
        db.commit()
        return
    item_id = item.id
    try:
        _step(db, store, transcriber, classifier, embedder, generator, speech, visual, job_id, item_id)
    except (ParseError, ImageError, TranscribeError, ClassifyError, EmbedError, MeetingError) as exc:
        item = db.get(JobItem, item_id)
        job = db.get(Job, job_id)
        item.status = "failed"
        item.error = str(exc)
        item.step = "done"
        job.retryable = True
        job.stage = str(exc)
    except Exception:
        item = db.get(JobItem, item_id)
        job = db.get(Job, job_id)
        item.attempts += 1
        if item.attempts >= 3:
            item.status = "failed"
            item.error = "The item could not be processed."
            item.step = "done"
        job.stage = "The last step failed and can be retried."
    job = db.get(Job, job_id)
    rows = items_for(db, job_id)
    _finish(job, rows)
    _summary_outcome(job, rows)
    job.lease_until = None
    job.updated_at = utcnow()
    db.commit()


def _step(db: Session, store, transcriber, classifier, embedder, generator, speech, visual, job_id: str, item_id: str) -> None:
    job = db.get(Job, job_id)
    item = db.get(JobItem, item_id)
    item.status = "running"
    if item.kind in {"summary", "summary-tasks"}:
        from app.meetings import advance_summary_item

        advance_summary_item(db, classifier, generator, job_id, item_id)
        return
    if item.step == "visual":
        _visual_step(db, store, visual, job_id, item_id)
        return
    if item.step == "embed":
        _embed_step(db, store, embedder, visual, job_id, item_id)
        return
    if item.step == "classify":
        _classify_step(db, classifier, job_id, item_id)
        return
    if item.step == "actions":
        _actions_step(db, classifier, job_id, item_id)
        return
    if item.step == "persist":
        _persist_step(db, store, embedder, visual, job, item)
        return
    if item.kind == "text":
        _ready(db, job, item, item.text_payload or "")
        return
    if item.media_type and item.media_type.startswith("audio/"):
        _audio_step(db, store, speech, job, item)
        return
    data, _media = store.get(item.object_key or "")
    if item.media_type == "application/pdf":
        _pdf_step(db, store, transcriber, job, item, data)
        return
    if item.media_type == DOCX:
        _ready(db, job, item, docx_text(data))
        return
    if item.media_type == "text/plain":
        _ready(db, job, item, plain_text(data, MAX_TEXT))
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
        _ready(db, job, item, item.partial_text)
        return
    if item.step == "transcribe":
        item_id = item.id
        job_id = job.id
        key = item.processed_key or ""
        db.commit()
        db.close()
        jpeg, _media = store.get(key)
        text = transcriber.transcribe(jpeg)
        item = db.get(JobItem, item_id)
        job = db.get(Job, job_id)
        joiner = "\n\f\n" if item.partial_text else ""
        item.partial_text = (item.partial_text + joiner + text).strip()
        item.page_index += 1
        item.step = "extract"
        job.stage = "Reading the next page."
        db.commit()
        return
    text = pdf_page_text(data, item.page_index)
    if text:
        joiner = "\n\f\n" if item.partial_text else ""
        item.partial_text = (item.partial_text + joiner + text).strip()
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
    _remember_page(item, item.page_index + 1, processed_key)
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
        _remember_page(item, 1, item.processed_key)
        item.preprocess_note = page.note
        item.step = "transcribe"
        job.stage = page.note or "Detecting the page boundary."
        db.commit()
        return
    item_id = item.id
    job_id = job.id
    key = item.processed_key or ""
    db.commit()
    db.close()
    jpeg, _media = store.get(key)
    text = transcriber.transcribe(jpeg)
    item = db.get(JobItem, item_id)
    job = db.get(Job, job_id)
    _ready(db, job, item, text)


def _audio_step(db, store, speech, job, item) -> None:
    if speech is None or not speech.configured:
        raise TranscribeError("Audio transcription is not configured.")
    item_id = item.id
    job_id = job.id
    key = item.object_key or ""
    media = item.media_type or "application/octet-stream"
    job.stage = "Transcribing the recording."
    db.commit()
    db.close()
    audio, stored_media = store.get(key)
    text = speech.transcribe(audio, stored_media or media, "recording")
    item = db.get(JobItem, item_id)
    job = db.get(Job, job_id)
    if job.cancel_requested:
        job.stage = "Cancelled before the transcript was saved."
        db.commit()
        return
    job.stage = "Saving the transcript."
    _ready(db, job, item, text)


def _ready(db, job: Job, item: JobItem, text: str) -> None:
    cleaned = text.strip()
    if not cleaned:
        raise ParseError("No text could be extracted.")
    if len(cleaned) > MAX_TEXT:
        raise ParseError("The extracted text is longer than the configured limit.")
    item.partial_text = cleaned
    item.step = "classify"
    job.stage = "Waiting to classify the extracted text."
    db.commit()


def _classify_step(db, classifier, job_id: str, item_id: str) -> None:
    item = db.get(JobItem, item_id)
    job = db.get(Job, job_id)
    text = item.partial_text
    title, _type, _tags, _type_chosen, _tags_chosen = _item_metadata(job, item)
    db.commit()
    db.close()
    result = classifier.classify(text, title)
    item = db.get(JobItem, item_id)
    job = db.get(Job, job_id)
    item.classification_json = json.dumps(result)
    item.step = "actions"
    job.stage = "Classifying the document."
    db.commit()


def _actions_step(db, classifier, job_id: str, item_id: str) -> None:
    item = db.get(JobItem, item_id)
    text = item.partial_text
    db.commit()
    db.close()
    actions = classifier.detect_actions(text, page=1)
    item = db.get(JobItem, item_id)
    job = db.get(Job, job_id)
    item.actions_json = json.dumps(actions)
    item.step = "persist"
    job.stage = "Finding action items."
    db.commit()


def _embed_step(db, store, embedder, visual, job_id: str, item_id: str) -> None:
    item = db.get(JobItem, item_id)
    document = db.get(Document, item.document_id) if item.document_id else None
    if document is None:
        raise EmbedError("The document is not available to index.")
    if embedder is None or not getattr(embedder, "configured", False):
        item.status = "failed"
        item.error = "Embedding is not configured."
        item.step = "done"
        job = db.get(Job, job_id)
        job.retryable = False
        job.stage = "Embedding is not configured."
        job.error = "Embedding is not configured."
        db.commit()
        return
    result = embed_next_chunk(db, embedder, document)
    item = db.get(JobItem, item_id)
    job = db.get(Job, job_id)
    if result == "unavailable":
        item.status = "failed"
        item.error = "Embedding is not configured."
        item.step = "done"
        job.retryable = False
        job.stage = "Embedding is not configured."
        job.error = "Embedding is not configured."
        db.commit()
        return
    if result == "complete" and visual is not None and getattr(visual, "configured", False) and item.document_id and _has_page_images(db, item.document_id):
        item.status = "running"
        item.step = "visual"
        job.stage = "Waiting to index page images."
    elif result == "complete":
        item.status = "succeeded"
        item.error = None
        item.step = "done"
        job.stage = "Indexing complete."
    else:
        item.status = "running"
        item.step = "embed"
        job.stage = "Embedding the next passage."
    db.commit()


def _visual_step(db, store, visual, job_id: str, item_id: str) -> None:
    item = db.get(JobItem, item_id)
    document = db.get(Document, item.document_id) if item.document_id else None
    if document is None:
        raise EmbedError("The document is not available to index.")
    try:
        outcome = advance_visual(db, store, visual, [document.id])
    except EmbedError as exc:
        item = db.get(JobItem, item_id)
        job = db.get(Job, job_id)
        item.status = "failed"
        item.error = str(exc)
        item.step = "visual"
        job.retryable = exc.retryable
        job.stage = str(exc)
        db.commit()
        return
    item = db.get(JobItem, item_id)
    job = db.get(Job, job_id)
    if outcome == "complete":
        item.status = "succeeded"
        item.error = None
        item.step = "done"
        job.stage = "Indexing complete."
    else:
        item.status = "running"
        item.step = "visual"
        job.stage = "Embedding a page region." if outcome == "embedded" else "Finding regions on the stored page."
    db.commit()


def _persist_step(db, store, embedder, visual, job: Job, item: JobItem) -> None:
    if item.document_id:
        document = db.get(Document, item.document_id)
        if document is not None:
            apply_extracted_tasks(db, job.owner_id, document, stored_actions(item.actions_json))
            item.status = "succeeded"
            item.error = None
            item.step = "done"
            job.stage = "Saving the classified document."
            db.commit()
            return
    title, document_type, tags, type_chosen, tags_chosen = _item_metadata(job, item)
    predicted = {}
    try:
        predicted = json.loads(item.classification_json or "{}")
    except json.JSONDecodeError:
        predicted = {}
    model_type = predicted.get("documentType") if predicted.get("documentType") in DOCUMENT_TYPES else "other"
    model_topics = [topic for topic in predicted.get("topics") or [] if isinstance(topic, str)]
    applied_type = not type_chosen
    applied_topics = not tags_chosen
    if applied_type:
        document_type = model_type
    if applied_topics:
        tags = model_topics
    now = utcnow()
    if item.media_type and item.media_type.startswith("audio/"):
        source_type = "audio"
    elif item.kind == "text":
        source_type = "text"
    else:
        source_type = "scanned" if item.processed_key else "digital"
    document = Document(
        id=new_id(),
        owner_id=job.owner_id,
        title=title,
        storage_bytes=_stored_size(store, item.object_key, item.processed_key, item.thumbnail_key),
        created_at=now,
        updated_at=now,
        source_type=source_type,
        document_type=document_type,
        tags=json.dumps(tags),
        text=item.partial_text,
        summary=item.preprocess_note,
        meeting_id=job.meeting_id,
        original_key=item.object_key,
        original_name=item.name if item.object_key else None,
        original_type=item.media_type if item.object_key else None,
        processed_key=item.processed_key,
        thumbnail_key=item.thumbnail_key,
        index_state="pending",
        index_version=0,
        classifier_id=predicted.get("modelId"),
        classification_json=json.dumps({**predicted, "applied": {"documentType": applied_type, "topics": applied_topics}}),
        type_locked=type_chosen,
        tags_locked=tags_chosen,
        labels_origin="model" if applied_type or applied_topics else "user",
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
            excerpt=item.partial_text[:240],
            page=1 if item.processed_key else None,
            meeting_id=job.meeting_id,
        )
    )
    apply_extracted_tasks(db, job.owner_id, document, stored_actions(item.actions_json))
    sync_chunks(db, document, text_changed=True, queue=False)
    _save_page_images(db, document, item)
    item.document_id = document.id
    visual_ready = visual is not None and getattr(visual, "configured", False) and _has_page_images(db, document.id)
    if embedder is not None and embedder.configured:
        item.status = "running"
        item.step = "embed"
        job.stage = "Waiting to embed the extracted text."
    elif visual_ready:
        item.status = "running"
        item.step = "visual"
        job.stage = "Waiting to index page images."
    else:
        item.status = "succeeded"
        item.error = None
        item.step = "done"
        job.stage = "Saving the classified document."
    db.commit()


def _remember_page(item: JobItem, page: int, key: str) -> None:
    try:
        pages = json.loads(item.page_images_json or "[]")
    except json.JSONDecodeError:
        pages = []
    if not isinstance(pages, list):
        pages = []
    if not any(isinstance(row, dict) and row.get("key") == key for row in pages):
        pages.append({"page": page, "key": key})
    item.page_images_json = json.dumps(pages)


def _save_page_images(db, document: Document, item: JobItem) -> None:
    try:
        pages = json.loads(item.page_images_json or "[]")
    except json.JSONDecodeError:
        pages = []
    if not isinstance(pages, list):
        return
    now = utcnow()
    for row in pages:
        if not isinstance(row, dict) or not row.get("key"):
            continue
        page = row.get("page")
        if not isinstance(page, int) or page < 1:
            continue
        db.add(PageImage(id=new_id(), document_id=document.id, page=page, image_key=row["key"], created_at=now))


def _has_page_images(db, document_id: str) -> bool:
    return db.scalar(select(PageImage.id).where(PageImage.document_id == document_id)) is not None


def _item_metadata(job: Job, item: JobItem) -> tuple[str, str, list, bool, bool]:
    meta = json.loads(job.payload_json or "{}")
    title = str(meta.get("title") or item.name)[:200]
    if meta.get("many"):
        title = f"{title} — {item.name}"[:200]
    tags = meta.get("tags") if isinstance(meta.get("tags"), list) else []
    document_type = str(meta.get("documentType") or "other")
    if document_type not in DOCUMENT_TYPES:
        document_type = "other"
    return title, document_type, tags, bool(meta.get("typeChosen")), bool(meta.get("tagsChosen"))


def _stored_size(store, *keys: str | None) -> int:
    total = 0
    for key in keys:
        if key:
            total += store.size(key)
    return total


def _summary_outcome(job: Job, rows: list[JobItem]) -> None:
    try:
        meta = json.loads(job.payload_json or "{}")
    except json.JSONDecodeError:
        return
    if not isinstance(meta, dict) or meta.get("kind") != "summary":
        return
    if any(row.status in {"queued", "running"} for row in rows):
        return
    summary_item = next((row for row in rows if row.kind == "summary"), None)
    if summary_item is not None and summary_item.status == "failed":
        job.status = "failed"
        job.retryable = True
        job.error = summary_item.error or "The meeting summary failed."
        job.stage = summary_item.error or "The meeting summary failed."


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
