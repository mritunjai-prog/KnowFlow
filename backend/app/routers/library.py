import json
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Request
from sqlalchemy import func, or_, select

from app.acl import can_edit, can_read, permission_for
from app.catalog import DOCUMENT_TYPES, MAX_TEXT_CHARACTERS
from app.deps import mutation_actor, reader
from app.errors import error_response
from app.models import Document, DocumentGrant, TimelineEvent
from app.schemas import DocumentOut, DocumentPage, DocumentPatchIn, FileSourceOut, SourceOut, TimelineOut, TimelinePage
from app.security import utcnow

router = APIRouter()


def _iso(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def _file(store, key: str | None, name: str | None, media: str | None) -> FileSourceOut | None:
    if not key:
        return None
    return FileSourceOut(url=store.signed_url(key, name or "file", media or "application/octet-stream"), mediaType=media or "application/octet-stream", name=name or "file")


def document_out(request: Request, document: Document, permission: str) -> DocumentOut:
    store = request.app.state.store
    tags = json.loads(document.tags or "[]")
    return DocumentOut(
        id=document.id,
        title=document.title,
        createdAt=_iso(document.created_at),
        sourceType=document.source_type if document.source_type in {"scanned", "digital", "text", "audio"} else "text",
        documentType=document.document_type,
        tags=tags if isinstance(tags, list) else [],
        text=document.text or "",
        original=_file(store, document.original_key, document.original_name, document.original_type),
        processed=_file(store, document.processed_key, "processed.jpg", "image/jpeg"),
        thumbnailUrl=store.signed_url(document.thumbnail_key, "thumbnail.jpg", "image/jpeg") if document.thumbnail_key else None,
        summary=document.summary,
        meetingId=document.meeting_id,
        permission=permission,
    )


@router.get("/documents")
def list_documents(
    request: Request,
    q: str | None = None,
    topic: str | None = None,
    type: str | None = None,
    from_: str | None = None,
    to: str | None = None,
    ownership: str | None = None,
    page: int = 1,
    pageSize: int = 20,
):
    # FastAPI maps query name "from" separately below.
    del from_
    return _list_documents(request, q, topic, type, request.query_params.get("from"), to, ownership, page, pageSize)


def _list_documents(request, q, topic, type, start, end, ownership, page, pageSize):
    actor, denied = reader(request)
    if denied:
        return denied
    if page < 1 or pageSize < 1 or pageSize > 100:
        return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request)
    if ownership not in {None, "", "all", "owned", "shared"}:
        return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request, {"ownership": "Use all, owned, or shared."})
    db = request.state.db
    user = actor.user
    shared_ids = select(DocumentGrant.document_id).where(DocumentGrant.grantee_user_id == user.id, DocumentGrant.status == "accepted")
    if ownership == "owned":
        visible = Document.owner_id == user.id
    elif ownership == "shared":
        visible = Document.id.in_(shared_ids)
    else:
        visible = or_(Document.owner_id == user.id, Document.id.in_(shared_ids))
    filters = [visible]
    if q:
        needle = f"%{q.replace('%', '').replace('_', '').lower()}%"
        filters.append(or_(func.lower(Document.title).like(needle), func.lower(Document.text).like(needle)))
    if topic:
        filters.append(func.lower(Document.tags).like(f"%{topic.strip().lower()}%"))
    if type:
        filters.append(Document.document_type == type)
    try:
        if start:
            filters.append(Document.created_at >= datetime.combine(datetime.fromisoformat(start).date(), time.min, timezone.utc))
        if end:
            filters.append(Document.created_at < datetime.combine(datetime.fromisoformat(end).date() + timedelta(days=1), time.min, timezone.utc))
    except ValueError:
        return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request, {"from": "Use YYYY-MM-DD."})
    total = db.scalar(select(func.count()).select_from(Document).where(*filters)) or 0
    rows = db.scalars(
        select(Document).where(*filters).order_by(Document.created_at.desc(), Document.id.desc()).offset((page - 1) * pageSize).limit(pageSize)
    ).all()
    return DocumentPage(
        items=[document_out(request, row, permission_for(db, user, row) or "view") for row in rows],
        total=int(total),
        page=page,
        pageSize=pageSize,
    )


@router.get("/documents/{document_id}")
def get_document(document_id: str, request: Request):
    actor, denied = reader(request)
    if denied:
        return denied
    document = request.state.db.get(Document, document_id)
    permission = permission_for(request.state.db, actor.user, document) if document else None
    if not document or not permission or not can_read(request.state.db, actor.user, document):
        return error_response(404, "NOT_FOUND", "That document is not available.", request)
    return document_out(request, document, permission)


@router.patch("/documents/{document_id}")
def patch_document(document_id: str, body: DocumentPatchIn, request: Request):
    actor, denied = mutation_actor(request)
    if denied:
        return denied
    db = request.state.db
    document = db.get(Document, document_id)
    if document is None or not can_read(db, actor.user, document):
        return error_response(404, "NOT_FOUND", "That document is not available.", request)
    if not can_edit(db, actor.user, document):
        return error_response(403, "FORBIDDEN", "You can view this document but not change it.", request)
    if body.documentType is not None and body.documentType not in DOCUMENT_TYPES:
        return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request, {"documentType": "Choose a known document type."})
    if body.tags is not None and (len(body.tags) != len(set(body.tags)) or any(not item.strip() for item in body.tags)):
        return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request, {"tags": "Tags must be unique text."})
    if body.text is not None and len(body.text) > MAX_TEXT_CHARACTERS:
        return error_response(413, "PAYLOAD_TOO_LARGE", "The text is longer than the configured limit.", request)
    if body.title is not None:
        document.title = body.title.strip()
    if body.documentType is not None:
        document.document_type = body.documentType
    if body.tags is not None:
        document.tags = json.dumps(body.tags)
    if body.text is not None:
        document.text = body.text
    document.updated_at = utcnow()
    document.index_state = "pending"
    event = db.scalar(select(TimelineEvent).where(TimelineEvent.document_id == document.id))
    if event:
        event.title = document.title
        event.type = document.document_type
        event.excerpt = (document.text or "")[:240]
    return document_out(request, document, permission_for(db, actor.user, document) or "owner")


@router.get("/timeline")
def timeline(
    request: Request,
    q: str | None = None,
    topic: str | None = None,
    type: str | None = None,
    timezone_name: str | None = None,
    page: int = 1,
    pageSize: int = 20,
):
    start = request.query_params.get("from")
    end = request.query_params.get("to")
    zone_name = request.query_params.get("timezone") or timezone_name or "UTC"
    actor, denied = reader(request)
    if denied:
        return denied
    if page < 1 or pageSize < 1 or pageSize > 100:
        return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request)
    try:
        zone = ZoneInfo(zone_name)
    except ZoneInfoNotFoundError:
        return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request, {"timezone": "Use an IANA timezone."})
    db = request.state.db
    user = actor.user
    shared_ids = select(DocumentGrant.document_id).where(DocumentGrant.grantee_user_id == user.id, DocumentGrant.status == "accepted")
    filters = [or_(TimelineEvent.owner_id == user.id, TimelineEvent.document_id.in_(shared_ids))]
    if q:
        needle = f"%{q.replace('%', '').replace('_', '').lower()}%"
        filters.append(func.lower(TimelineEvent.title).like(needle))
    if type:
        filters.append(TimelineEvent.type == type)
    if topic:
        filters.append(TimelineEvent.document_id.in_(select(Document.id).where(func.lower(Document.tags).like(f"%{topic.strip().lower()}%"))))
    try:
        if start:
            start_day = datetime.fromisoformat(start).date()
            filters.append(TimelineEvent.occurred_at >= datetime.combine(start_day, time.min, zone).astimezone(timezone.utc))
        if end:
            end_day = datetime.fromisoformat(end).date() + timedelta(days=1)
            filters.append(TimelineEvent.occurred_at < datetime.combine(end_day, time.min, zone).astimezone(timezone.utc))
    except ValueError:
        return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request, {"from": "Use YYYY-MM-DD."})
    total = db.scalar(select(func.count()).select_from(TimelineEvent).where(*filters)) or 0
    rows = db.scalars(
        select(TimelineEvent).where(*filters).order_by(TimelineEvent.occurred_at.desc(), TimelineEvent.id.desc()).offset((page - 1) * pageSize).limit(pageSize)
    ).all()
    items = []
    for row in rows:
        document = db.get(Document, row.document_id)
        if document is None or not can_read(db, user, document):
            continue
        source = {"documentId": document.id, "title": document.title, "page": row.page or 1}
        if row.excerpt:
            source["excerpt"] = row.excerpt
        items.append(
            TimelineOut(
                id=row.id,
                occurredAt=_iso(row.occurred_at),
                title=row.title,
                type=row.type,
                source=SourceOut(**source),
                meetingId=row.meeting_id,
            )
        )
    return TimelinePage(items=items, total=int(total), page=page, pageSize=pageSize)
