"""Owner-scoped meeting grouping and one-step grounded summary jobs."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.classify import grounded, sentences
from app.generate import GenerateError
from app.models import Document, Job, JobItem, Meeting, TaskRecord
from app.security import aware, new_id, utcnow
from app.tasking import reconcile_extracted_tasks, stored_actions

ABSTAIN = "I cannot summarize decisions from the available meeting artifacts."
FAILED = "The last summary attempt failed. Retry after the artifacts finish processing."
STALE = "This summary is out of date because a meeting artifact changed. Generate the summary again."
EXCERPT_LIMIT = 4000


class MeetingError(Exception):
    def __init__(self, message: str, retryable: bool = False):
        super().__init__(message)
        self.retryable = retryable


def parse_occurred_at(value) -> tuple[datetime | None, tuple | None]:
    try:
        when = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None, (422, "VALIDATION_ERROR", "The meeting time is invalid.")
    if when.tzinfo is None:
        return None, (422, "VALIDATION_ERROR", "The meeting time must include a timezone.")
    return when, None


def find_session(db: Session, owner_id: str, title: str, when: datetime) -> Meeting | None:
    target = title.strip().casefold()
    instant = aware(when)
    rows = db.scalars(select(Meeting).where(Meeting.owner_id == owner_id).order_by(Meeting.created_at, Meeting.id)).all()
    for row in rows:
        if row.title.strip().casefold() == target and aware(row.occurred_at) == instant:
            return row
    return None


def attach_meeting(db: Session, owner_id: str, meeting_id, title, occurred) -> tuple[Meeting | None, tuple | None]:
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
        when, error = parse_occurred_at(occurred)
        if error:
            return None, error
        existing = find_session(db, owner_id, str(title), when)
        if existing is not None:
            return existing, None
        meeting = Meeting(
            id=new_id(),
            owner_id=owner_id,
            title=str(title).strip()[:200],
            occurred_at=when,
            created_at=utcnow(),
            summary=None,
            decisions_json="[]",
            summary_state="empty",
            evidence_hash=None,
        )
        db.add(meeting)
        db.flush()
        return meeting, None
    return None, None


def owned_artifacts(db: Session, meeting: Meeting) -> list[Document]:
    return list(
        db.scalars(
            select(Document)
            .where(Document.owner_id == meeting.owner_id, Document.meeting_id == meeting.id)
            .order_by(Document.created_at, Document.id)
        )
    )


def evidence_hash(documents: list[Document]) -> str:
    rows = [
        {
            "id": document.id,
            "version": int(document.index_version or 0),
            "text": hashlib.sha256((document.text or "").encode()).hexdigest(),
        }
        for document in sorted(documents, key=lambda item: item.id)
    ]
    return hashlib.sha256(json.dumps(rows, sort_keys=True).encode()).hexdigest()


def visible_summary(meeting: Meeting, documents: list[Document]) -> tuple[str | None, list[str]]:
    if meeting.summary_state in {"current", "partial"} and meeting.evidence_hash and meeting.evidence_hash != evidence_hash(documents):
        return STALE, []
    if meeting.summary_state == "failed":
        return meeting.summary or FAILED, []
    if meeting.summary_state == "empty" or not meeting.summary:
        return None, []
    try:
        stored = json.loads(meeting.decisions_json or "[]")
    except json.JSONDecodeError:
        stored = []
    decisions = [item for item in stored if isinstance(item, str)]
    return meeting.summary, decisions


def _meta(job: Job) -> dict:
    try:
        value = json.loads(job.payload_json or "{}")
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}


def _excerpts(documents: list[Document]) -> tuple[list[dict], int, int]:
    excerpts = []
    missing = 0
    truncated = 0
    for document in documents:
        pages = [page.strip() for page in (document.text or "").split("\f") if page.strip()]
        if not pages:
            missing += 1
            continue
        for number, page in enumerate(pages, start=1):
            text = page
            if len(text) > EXCERPT_LIMIT:
                text = text[:EXCERPT_LIMIT]
                truncated += 1
            excerpts.append({"documentId": document.id, "title": document.title, "page": number, "text": text})
    return excerpts, missing, truncated


def _accept(parsed: dict | None, corpus: str, missing: int, truncated: int) -> tuple[str, list[str], str]:
    insufficient = not isinstance(parsed, dict) or parsed.get("insufficientEvidence") is True
    decisions = []
    if not insufficient and isinstance(parsed, dict):
        for item in parsed.get("decisions") or []:
            sentence = str(item).strip()
            if sentence and grounded(corpus, sentence) and sentence not in decisions:
                decisions.append(sentence[:500])
        raw = str(parsed.get("summary") or "").strip()
        summary_ok = bool(raw) and all(grounded(corpus, sentence) for sentence in sentences(raw))
        summary = raw if summary_ok else (" ".join(decisions) if decisions else ABSTAIN)
        if not decisions and not summary_ok:
            summary = ABSTAIN
    else:
        summary = ABSTAIN
        decisions = []
    if missing or truncated:
        summary = (
            f"{summary}\n\nThis summary is partial: {missing} artifact(s) had no extracted text"
            f" and {truncated} excerpt(s) were shortened. Decisions use only the text that was available."
        )
        state = "partial"
    elif summary == ABSTAIN:
        state = "current"
    else:
        state = "current"
    return summary[:8000], decisions, state


def _mark_failed(meeting: Meeting) -> None:
    if meeting.summary_state in {"current", "partial"} and meeting.evidence_hash:
        return
    meeting.summary = FAILED
    meeting.decisions_json = "[]"
    meeting.summary_state = "failed"
    meeting.evidence_hash = None


def advance_summary_item(db: Session, classifier, generator, job_id: str, item_id: str) -> None:
    item = db.get(JobItem, item_id)
    job = db.get(Job, job_id)
    if item.kind == "summary":
        _summarize(db, generator, job_id, item_id)
        return
    _tasks(db, classifier, job_id, item_id)


def _summarize(db: Session, generator, job_id: str, item_id: str) -> None:
    job = db.get(Job, job_id)
    item = db.get(JobItem, item_id)
    meeting = db.get(Meeting, job.meeting_id) if job.meeting_id else None
    if meeting is None or meeting.owner_id != job.owner_id:
        raise MeetingError("That meeting is not available.")
    documents = owned_artifacts(db, meeting)
    excerpts, missing, truncated = _excerpts(documents)
    if not excerpts:
        meeting.summary = (
            "No extracted text is available yet. Add processed artifacts, then generate the summary again."
        )
        meeting.decisions_json = "[]"
        meeting.summary_state = "partial"
        meeting.evidence_hash = evidence_hash(documents)
        item.status = "succeeded"
        item.step = "done"
        job.stage = "The meeting has no extracted text yet."
        db.commit()
        return
    if generator is None or not getattr(generator, "configured", False):
        _mark_failed(meeting)
        raise MeetingError("Meeting summary is not configured.", retryable=True)
    before = evidence_hash(documents)
    allowed = {document.id for document in documents}
    if any(item_excerpt["documentId"] not in allowed for item_excerpt in excerpts):
        raise MeetingError("The summary included an artifact from outside this meeting.")
    corpus = "\n".join(document.text or "" for document in documents)
    db.commit()
    try:
        parsed = generator.summarize_meeting(excerpts)
    except GenerateError as exc:
        meeting = db.get(Meeting, job.meeting_id)
        if meeting is not None:
            _mark_failed(meeting)
        raise MeetingError(str(exc), retryable=exc.retryable) from exc
    db.expire_all()
    job = db.get(Job, job_id)
    item = db.get(JobItem, item_id)
    meeting = db.get(Meeting, job.meeting_id)
    if job.cancel_requested or meeting is None or meeting.owner_id != job.owner_id:
        job.stage = "Cancelled before a summary was saved."
        db.commit()
        return
    documents = owned_artifacts(db, meeting)
    if evidence_hash(documents) != before:
        job.stage = "Meeting artifacts changed. The next step will use the corrected text."
        item.step = "summarize"
        item.status = "running"
        db.commit()
        return
    summary, decisions, state = _accept(parsed if isinstance(parsed, dict) else None, corpus, missing, truncated)
    meeting.summary = summary
    meeting.decisions_json = json.dumps(decisions)
    meeting.summary_state = state
    meeting.evidence_hash = before
    item.status = "succeeded"
    item.error = None
    item.step = "done"
    job.stage = "Saving grounded decisions."
    db.commit()


def _tasks(db: Session, classifier, job_id: str, item_id: str) -> None:
    job = db.get(Job, job_id)
    item = db.get(JobItem, item_id)
    meeting = db.get(Meeting, job.meeting_id) if job.meeting_id else None
    if meeting is None or meeting.owner_id != job.owner_id:
        raise MeetingError("That meeting is not available.")
    if classifier is None:
        raise MeetingError("Task extraction is not configured.", retryable=True)
    documents = owned_artifacts(db, meeting)
    meta = _meta(job)
    doc_index = int(meta.get("docIndex") or 0)
    page_index = int(meta.get("pageIndex") or 0)
    if doc_index >= len(documents):
        item.status = "succeeded"
        item.error = None
        item.step = "done"
        job.stage = "Meeting tasks are up to date."
        db.commit()
        return
    document = documents[doc_index]
    pages = (document.text or "").split("\f") if document.text else [""]
    if page_index >= len(pages) or not any(page.strip() for page in pages):
        reconcile_extracted_tasks(db, job.owner_id, document, stored_actions(item.actions_json))
        item.actions_json = "[]"
        meta["docIndex"] = doc_index + 1
        meta["pageIndex"] = 0
        job.payload_json = json.dumps(meta)
        item.step = "tasks"
        job.stage = "Checking the next meeting artifact."
        db.commit()
        return
    page_text = pages[page_index]
    page_number = page_index + 1
    document_id = document.id
    if not page_text.strip():
        meta["pageIndex"] = page_index + 1
        job.payload_json = json.dumps(meta)
        db.commit()
        return
    db.commit()
    found = classifier.detect_actions(page_text, page=page_number)
    db.expire_all()
    job = db.get(Job, job_id)
    item = db.get(JobItem, item_id)
    meeting = db.get(Meeting, job.meeting_id)
    document = db.get(Document, document_id)
    if job.cancel_requested:
        job.stage = "Cancelled before the remaining tasks were saved."
        db.commit()
        return
    if document is None or meeting is None or document.owner_id != job.owner_id or document.meeting_id != meeting.id:
        raise MeetingError("That artifact is no longer in this meeting.")
    current_pages = (document.text or "").split("\f") if document.text else [""]
    if page_index >= len(current_pages) or current_pages[page_index] != page_text:
        item.actions_json = "[]"
        meta = _meta(job)
        meta["pageIndex"] = 0
        job.payload_json = json.dumps(meta)
        job.stage = "An artifact changed. Task extraction will use the corrected text."
        db.commit()
        return
    accumulated = stored_actions(item.actions_json)
    accumulated.extend(found)
    item.actions_json = json.dumps(accumulated)
    meta = _meta(job)
    meta["pageIndex"] = page_index + 1
    if meta["pageIndex"] >= len(current_pages):
        reconcile_extracted_tasks(db, job.owner_id, document, accumulated)
        item.actions_json = "[]"
        meta["docIndex"] = doc_index + 1
        meta["pageIndex"] = 0
        job.stage = "Saving deduplicated meeting tasks."
    else:
        job.stage = "Extracting tasks from the next page."
    job.payload_json = json.dumps(meta)
    item.step = "tasks"
    item.status = "running"
    db.commit()
