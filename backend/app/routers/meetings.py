"""Personal meetings. A shared artifact does not reveal the meeting or its siblings."""

from __future__ import annotations

import json
from datetime import timezone

from fastapi import APIRouter, Request
from sqlalchemy import func, select

from app.deps import mutation_actor, reader
from app.errors import error_response
from app.meetings import owned_artifacts, parse_occurred_at, visible_summary
from app.models import Job, JobItem, Meeting, TaskRecord
from app.routers.capture import job_out
from app.routers.library import document_out
from app.routers.tasks import task_out
from app.schemas import MeetingIn, MeetingOut, MeetingPage
from app.security import new_id, utcnow

router = APIRouter()


def _iso(value) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def _task_documents(documents, tasks):
    by_id = {document.id: document for document in documents}
    return [task_out(by_id[task.document_id], task) for task in tasks if task.document_id in by_id]


def render_meeting(request: Request, meeting: Meeting) -> MeetingOut:
    db = request.state.db
    documents = owned_artifacts(db, meeting)
    summary, decisions = visible_summary(meeting, documents)
    doc_ids = [document.id for document in documents]
    tasks = []
    if doc_ids:
        tasks = list(
            db.scalars(
                select(TaskRecord)
                .where(TaskRecord.owner_id == meeting.owner_id, TaskRecord.document_id.in_(doc_ids))
                .order_by(TaskRecord.created_at.asc(), TaskRecord.id.asc())
            )
        )
    return MeetingOut(
        id=meeting.id,
        title=meeting.title,
        occurredAt=_iso(meeting.occurred_at),
        summary=summary,
        decisions=decisions,
        documents=[document_out(request, document, "owner") for document in documents],
        tasks=_task_documents(documents, tasks),
    )


def _owned(db, user_id: str, meeting_id: str) -> Meeting | None:
    meeting = db.get(Meeting, meeting_id)
    if meeting is None or meeting.owner_id != user_id:
        return None
    return meeting


def _summary_job(db, owner_id: str, meeting_id: str) -> Job | None:
    rows = db.scalars(
        select(Job).where(Job.owner_id == owner_id, Job.meeting_id == meeting_id, Job.status.in_(("queued", "running")))
    ).all()
    for job in rows:
        try:
            meta = json.loads(job.payload_json or "{}")
        except json.JSONDecodeError:
            continue
        if isinstance(meta, dict) and meta.get("kind") == "summary":
            return job
    return None


@router.get("/meetings")
def list_meetings(request: Request, q: str | None = None, page: int = 1, pageSize: int = 20):
    actor, denied = reader(request)
    if denied:
        return denied
    if page < 1 or pageSize < 1 or pageSize > 100:
        return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request)
    db = request.state.db
    filters = [Meeting.owner_id == actor.user.id]
    if q and q.strip():
        needle = f"%{q.strip().replace('%', '').replace('_', '').lower()}%"
        filters.append(func.lower(Meeting.title).like(needle))
    total = db.scalar(select(func.count()).select_from(Meeting).where(*filters)) or 0
    rows = db.scalars(
        select(Meeting)
        .where(*filters)
        .order_by(Meeting.occurred_at.desc(), Meeting.id.desc())
        .offset((page - 1) * pageSize)
        .limit(pageSize)
    ).all()
    return MeetingPage(items=[render_meeting(request, row) for row in rows], total=int(total), page=page, pageSize=pageSize)


@router.post("/meetings", status_code=201)
def create_meeting(body: MeetingIn, request: Request):
    actor, denied = mutation_actor(request)
    if denied:
        return denied
    when, error = parse_occurred_at(body.occurredAt)
    if error:
        return error_response(error[0], error[1], error[2], request, {"occurredAt": error[2]})
    title = body.title.strip()
    if not title:
        return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request, {"title": "Enter a title."})
    now = utcnow()
    meeting = Meeting(
        id=new_id(),
        owner_id=actor.user.id,
        title=title[:200],
        occurred_at=when,
        created_at=now,
        summary=None,
        decisions_json="[]",
        summary_state="empty",
        evidence_hash=None,
    )
    request.state.db.add(meeting)
    request.state.db.flush()
    return render_meeting(request, meeting)


@router.get("/meetings/{meeting_id}")
def get_meeting(meeting_id: str, request: Request):
    actor, denied = reader(request)
    if denied:
        return denied
    meeting = _owned(request.state.db, actor.user.id, meeting_id)
    if meeting is None:
        return error_response(404, "NOT_FOUND", "That meeting is not available.", request)
    return render_meeting(request, meeting)


@router.post("/meetings/{meeting_id}/summarize", status_code=202)
def summarize_meeting(meeting_id: str, request: Request):
    actor, denied = mutation_actor(request)
    if denied:
        return denied
    db = request.state.db
    meeting = _owned(db, actor.user.id, meeting_id)
    if meeting is None:
        return error_response(404, "NOT_FOUND", "That meeting is not available.", request)
    documents = owned_artifacts(db, meeting)
    if not documents:
        return error_response(422, "VALIDATION_ERROR", "Add processed artifacts before generating a summary.", request)
    existing = _summary_job(db, actor.user.id, meeting.id)
    if existing is not None:
        return job_out(db, existing)
    now = utcnow()
    job = Job(
        id=new_id(),
        owner_id=actor.user.id,
        status="queued",
        created_at=now,
        updated_at=now,
        stage="Waiting to summarize the meeting.",
        progress=0,
        error=None,
        retryable=False,
        meeting_id=meeting.id,
        payload_json=json.dumps({"kind": "summary", "docIndex": 0, "pageIndex": 0}),
    )
    db.add(job)
    db.flush()
    db.add(
        JobItem(
            id=new_id(),
            job_id=job.id,
            position=0,
            name="Summary",
            status="queued",
            kind="summary",
            step="summarize",
            partial_text="",
        )
    )
    db.add(
        JobItem(
            id=new_id(),
            job_id=job.id,
            position=1,
            name="Tasks",
            status="queued",
            kind="summary-tasks",
            step="tasks",
            partial_text="",
            actions_json="[]",
        )
    )
    db.flush()
    return job_out(db, job)
