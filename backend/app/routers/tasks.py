from fastapi import APIRouter, Request, Response
from sqlalchemy import delete, func, or_, select

from app.acl import can_read
from app.deps import mutation_actor, reader
from app.errors import error_response
from app.models import Document, DocumentGrant, TaskRecord, TaskStatusEvent
from app.schemas import SourceOut, TaskIn, TaskOut, TaskPage, TaskPatch
from app.security import new_id, utcnow
from app.tasking import remember_deletion

router = APIRouter()


def _source(document: Document, task: TaskRecord) -> SourceOut:
    payload = {"documentId": document.id, "title": document.title}
    if task.page is not None:
        payload["page"] = task.page
    if task.excerpt:
        payload["excerpt"] = task.excerpt
    return SourceOut(**payload)


def task_out(document: Document, task: TaskRecord) -> TaskOut:
    meeting_id = task.meeting_id if document.owner_id == task.owner_id else None
    return TaskOut(
        id=task.id,
        description=task.description,
        status=task.status if task.status in {"pending", "completed"} else "pending",
        priority=task.priority if task.priority in {"low", "medium", "high"} else "medium",
        dueDate=task.due_date,
        source=_source(document, task),
        meetingId=meeting_id,
    )


def _readable_ids(user_id: str):
    shared = select(DocumentGrant.document_id).where(
        DocumentGrant.grantee_user_id == user_id,
        DocumentGrant.status == "accepted",
    )
    return select(Document.id).where(or_(Document.owner_id == user_id, Document.id.in_(shared)))


def _note_status(db, task: TaskRecord, previous: str, moment) -> None:
    """Record a real transition once. A repeated complete or reopen does not add another event."""
    if task.status == previous:
        return
    seq = int(db.scalar(select(func.max(TaskStatusEvent.seq)).where(TaskStatusEvent.task_id == task.id)) or 0) + 1
    if previous != "completed" and task.status == "completed":
        task.completed_at = moment
        kind = "completed"
    elif previous == "completed" and task.status != "completed":
        task.completed_at = None
        kind = "reopened"
    else:
        return
    db.add(
        TaskStatusEvent(
            id=new_id(),
            owner_id=task.owner_id,
            task_id=task.id,
            document_id=task.document_id,
            kind=kind,
            seq=seq,
            occurred_at=moment,
        )
    )


def _owned_task(db, user, task_id: str) -> tuple[TaskRecord | None, Document | None]:
    task = db.get(TaskRecord, task_id)
    if task is None or task.owner_id != user.id:
        return None, None
    document = db.get(Document, task.document_id)
    if document is None or not can_read(db, user, document):
        return None, None
    return task, document


@router.get("/tasks")
def list_tasks(
    request: Request,
    q: str | None = None,
    status: str | None = None,
    sourceId: str | None = None,
    page: int = 1,
    pageSize: int = 20,
):
    actor, denied = reader(request)
    if denied:
        return denied
    if page < 1 or pageSize < 1 or pageSize > 100:
        return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request)
    if status not in {None, "", "pending", "completed"}:
        return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request, {"status": "Use pending or completed."})
    db = request.state.db
    user = actor.user
    filters = [TaskRecord.owner_id == user.id, TaskRecord.document_id.in_(_readable_ids(user.id))]
    if q:
        needle = f"%{q.replace('%', '').replace('_', '').lower()}%"
        filters.append(func.lower(TaskRecord.description).like(needle))
    if status:
        filters.append(TaskRecord.status == status)
    if sourceId:
        filters.append(TaskRecord.document_id == sourceId)
    total = db.scalar(select(func.count()).select_from(TaskRecord).where(*filters)) or 0
    rows = db.scalars(
        select(TaskRecord).where(*filters).order_by(TaskRecord.created_at.asc(), TaskRecord.id.asc()).offset((page - 1) * pageSize).limit(pageSize)
    ).all()
    items = []
    for task in rows:
        document = db.get(Document, task.document_id)
        if document is None or not can_read(db, user, document):
            continue
        items.append(task_out(document, task))
    return TaskPage(items=items, total=int(total), page=page, pageSize=pageSize)


@router.post("/tasks", status_code=201)
def create_task(body: TaskIn, request: Request):
    actor, denied = mutation_actor(request)
    if denied:
        return denied
    db = request.state.db
    document = db.get(Document, body.sourceDocumentId)
    if document is None or not can_read(db, actor.user, document):
        return error_response(404, "NOT_FOUND", "That document is not available.", request)
    now = utcnow()
    task = TaskRecord(
        id=new_id(),
        owner_id=actor.user.id,
        document_id=document.id,
        description=body.description,
        status="pending",
        priority=body.priority,
        due_date=body.dueDate,
        page=None,
        excerpt=None,
        meeting_id=document.meeting_id if document.owner_id == actor.user.id else None,
        origin="manual",
        fingerprint=None,
        user_edited=False,
        created_at=now,
        updated_at=now,
    )
    db.add(task)
    db.flush()
    return task_out(document, task)


@router.patch("/tasks/{task_id}")
def patch_task(task_id: str, body: TaskPatch, request: Request):
    actor, denied = mutation_actor(request)
    if denied:
        return denied
    task, document = _owned_task(request.state.db, actor.user, task_id)
    if task is None or document is None:
        return error_response(404, "NOT_FOUND", "That task is not available.", request)
    changed = body.model_dump(exclude_unset=True)
    previous = task.status
    moment = utcnow()
    if "description" in changed:
        task.description = changed["description"]
    if "priority" in changed:
        task.priority = changed["priority"]
    if "dueDate" in changed:
        task.due_date = changed["dueDate"]
    if "status" in changed:
        task.status = changed["status"]
        _note_status(request.state.db, task, previous, moment)
    if changed:
        task.user_edited = True
        task.updated_at = moment
    return task_out(document, task)


@router.delete("/tasks/{task_id}")
def delete_task(task_id: str, request: Request):
    actor, denied = mutation_actor(request)
    if denied:
        return denied
    task, document = _owned_task(request.state.db, actor.user, task_id)
    if task is None or document is None:
        return error_response(404, "NOT_FOUND", "That task is not available.", request)
    remember_deletion(request.state.db, task)
    request.state.db.execute(delete(TaskStatusEvent).where(TaskStatusEvent.task_id == task.id))
    request.state.db.delete(task)
    return Response(status_code=204)
