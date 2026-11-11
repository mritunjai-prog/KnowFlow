"""Asynchronous grounded questions. One poll performs one embed or one generation."""

from __future__ import annotations

import hashlib
import json
from datetime import timedelta, timezone

from fastapi import APIRouter, File, Form, Request, UploadFile
from sqlalchemy import func, select

from app.catalog import MAX_FILE_BYTES, MAX_TEXT_CHARACTERS
from app.deps import mutation_actor, reader
from app.embeddings import RETRIEVAL_QUERY, EmbedError
from app.errors import error_response
from app.generate import GenerateError
from app.imaging import ImageError, crop_jpeg, query_jpeg, valid_region
from app.indexing import embed_next_chunk, pending_chunk
from app.acl import can_read
from app.models import Conversation, ConversationMessage, Document, DocumentChunk, QueryJob, User, VisualRegion
from app.rate_limit import hit
from app.retrieve import accessible_ids, search
from app.schemas import AnswerOut, ConversationOut, ConversationPage, MessageOut, QueryJobOut, SourceOut
from app.security import aware, new_id, utcnow
from app.storage import StorageError
from app.visual import VISUAL_MODEL, advance_visual, search_visual

router = APIRouter()
LEASE = timedelta(seconds=20)
ABSTAIN = "I cannot answer that from the documents you can access."
REDACTED = "This saved answer is no longer available because its source changed or access was removed."


def _iso(value) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def _context(raw: str) -> dict | None:
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(value, dict) or set(value) != {"conversationId", "documentIds"}:
        return None
    if value["conversationId"] is not None and not isinstance(value["conversationId"], str):
        return None
    ids = value["documentIds"]
    if not isinstance(ids, list) or any(not isinstance(item, str) or not item for item in ids):
        return None
    return value


def _source(payload: dict) -> SourceOut:
    data = {"documentId": payload["documentId"], "title": payload["title"]}
    if payload.get("page") is not None:
        data["page"] = payload["page"]
    if payload.get("excerpt"):
        data["excerpt"] = payload["excerpt"]
    region = payload.get("region")
    if valid_region(region):
        data["region"] = [float(item) for item in region]
    return SourceOut(**data)


def _message_out(db, user: User, message: ConversationMessage) -> MessageOut:
    stored = []
    try:
        stored = json.loads(message.sources_json or "[]")
    except json.JSONDecodeError:
        stored = []
    if message.role != "assistant":
        return MessageOut(
            id=message.id,
            role="user",
            text=message.text,
            createdAt=_iso(message.created_at),
            sources=[],
            insufficientEvidence=False,
        )
    visible = []
    blocked = False
    for item in stored:
        if not isinstance(item, dict) or not item.get("documentId"):
            blocked = True
            continue
        document = db.get(Document, item["documentId"])
        if document is None or not can_read(db, user, document):
            blocked = True
            continue
        if item.get("regionId"):
            region = db.get(VisualRegion, item["regionId"])
            box = (region.x, region.y, region.width, region.height) if region is not None else None
            if region is None or region.document_id != document.id or region.state != "current" or not valid_region(box):
                blocked = True
                continue
            visible.append(
                _source(
                    {
                        "documentId": document.id,
                        "title": document.title,
                        "page": region.page,
                        "excerpt": "Stored page image.",
                        "region": [region.x, region.y, region.width, region.height],
                    }
                )
            )
            continue
        chunk = db.get(DocumentChunk, item.get("chunkId")) if item.get("chunkId") else None
        if chunk is None or chunk.state != "current" or chunk.index_version != document.index_version:
            blocked = True
            continue
        visible.append(_source({**item, "title": document.title, "excerpt": chunk.text[:500], "page": chunk.page}))
    if blocked or (stored and not visible):
        return MessageOut(
            id=message.id,
            role="assistant",
            text=REDACTED,
            createdAt=_iso(message.created_at),
            sources=[],
            insufficientEvidence=True,
        )
    return MessageOut(
        id=message.id,
        role="assistant",
        text=message.text,
        createdAt=_iso(message.created_at),
        sources=visible,
        insufficientEvidence=message.insufficient_evidence,
    )


def _conversation_out(db, user: User, conversation: Conversation) -> ConversationOut:
    rows = db.scalars(
        select(ConversationMessage)
        .where(ConversationMessage.conversation_id == conversation.id)
        .order_by(ConversationMessage.created_at.asc(), ConversationMessage.id.asc())
    ).all()
    return ConversationOut(
        id=conversation.id,
        title=conversation.title,
        updatedAt=_iso(conversation.updated_at),
        messages=[_message_out(db, user, row) for row in rows],
    )


def _answer(db, user: User, conversation_id: str) -> AnswerOut | None:
    rows = db.scalars(
        select(ConversationMessage)
        .where(ConversationMessage.conversation_id == conversation_id)
        .order_by(ConversationMessage.created_at.asc(), ConversationMessage.id.asc())
    ).all()
    if len(rows) < 2:
        return None
    return AnswerOut(conversationId=conversation_id, userMessage=_message_out(db, user, rows[-2]), answer=_message_out(db, user, rows[-1]))


def query_out(db, user: User, query: QueryJob) -> QueryJobOut:
    answer = None
    if query.status == "succeeded" and query.conversation_id:
        answer = _answer(db, user, query.conversation_id)
    return QueryJobOut(
        id=query.id,
        status=query.status if query.status in {"queued", "running", "succeeded", "failed", "cancelled"} else "failed",
        stage=query.stage,
        conversationId=query.conversation_id,
        answer=answer,
        error=query.error,
    )


def _scope(db, user: User, requested: list[str]) -> tuple[list[str] | None, str | None]:
    allowed = accessible_ids(db, user)
    if requested:
        if any(item not in allowed for item in requested):
            return None, "missing"
        return requested, None
    return list(allowed), None


def _history(db, conversation_id: str | None) -> list[str]:
    if not conversation_id:
        return []
    rows = db.scalars(
        select(ConversationMessage)
        .where(ConversationMessage.conversation_id == conversation_id, ConversationMessage.role == "user")
        .order_by(ConversationMessage.created_at.desc(), ConversationMessage.id.desc())
        .limit(3)
    ).all()
    return [row.text[:300] for row in reversed(rows)]


def _persist_pair(db, query: QueryJob, text: str, sources: list[dict], insufficient: bool) -> None:
    now = utcnow()
    later = now + timedelta(microseconds=1)
    db.add(
        ConversationMessage(
            id=new_id(),
            conversation_id=query.conversation_id,
            role="user",
            text=query.query_text,
            created_at=now,
            insufficient_evidence=False,
            sources_json="[]",
        )
    )
    db.add(
        ConversationMessage(
            id=new_id(),
            conversation_id=query.conversation_id,
            role="assistant",
            text=text,
            created_at=later,
            insufficient_evidence=insufficient,
            sources_json=json.dumps(sources),
        )
    )
    conversation = db.get(Conversation, query.conversation_id)
    if conversation is not None:
        conversation.updated_at = now
    query.status = "succeeded"
    query.step = "done"
    query.error = None
    query.stage = "Answer saved."
    db.commit()


def _drop_query_image(store, query: QueryJob) -> None:
    if store is None or not query.image_key:
        return
    try:
        store.delete(query.image_key)
    except StorageError:
        pass
    query.image_key = None


def _has_current_visual(db, document_ids: list[str]) -> bool:
    if not document_ids:
        return False
    return (
        db.scalar(
            select(VisualRegion.id).where(
                VisualRegion.document_id.in_(document_ids),
                VisualRegion.state == "current",
                VisualRegion.model_id == VISUAL_MODEL,
            )
        )
        is not None
    )


def advance_query(db, embedder, generator, query: QueryJob, visual=None, store=None) -> None:
    now = utcnow()
    if query.status in {"succeeded", "failed", "cancelled"} and not query.cancel_requested:
        return
    if query.lease_until is not None and aware(query.lease_until) > now and query.status == "running":
        return
    if query.cancel_requested or query.status == "cancelled":
        query.status = "cancelled"
        query.stage = "Cancelled before an answer was saved."
        _drop_query_image(store, query)
        query.lease_until = None
        query.updated_at = now
        db.commit()
        return
    query_id = query.id
    query.lease_until = now + LEASE
    query.status = "running"
    query.updated_at = now
    db.commit()
    try:
        _query_step(db, embedder, generator, query_id, visual, store)
    except (EmbedError, GenerateError, StorageError) as exc:
        query = db.get(QueryJob, query_id)
        query.status = "failed"
        query.retryable = bool(getattr(exc, "retryable", False))
        query.error = str(exc)
        query.stage = str(exc)
        query.lease_until = None
        query.updated_at = utcnow()
        db.commit()
        return
    query = db.get(QueryJob, query_id)
    if query is not None:
        if query.status in {"succeeded", "failed", "cancelled"}:
            _drop_query_image(store, query)
        query.lease_until = None
        query.updated_at = utcnow()
        db.commit()


def _query_step(db, embedder, generator, query_id: str, visual=None, store=None) -> None:
    query = db.get(QueryJob, query_id)
    user = db.get(User, query.owner_id)
    requested = json.loads(query.document_ids_json or "[]")
    scope, problem = _scope(db, user, requested)
    if problem:
        _persist_pair(db, query, REDACTED, [], True)
        return
    if not scope:
        _persist_pair(db, query, ABSTAIN, [], True)
        return
    waiting = pending_chunk(db, scope)
    if waiting is not None:
        document = db.get(Document, waiting.document_id)
        if embedder is None or not getattr(embedder, "configured", False):
            raise EmbedError("Embedding is not configured.")
        result = embed_next_chunk(db, embedder, document)
        query = db.get(QueryJob, query_id)
        if result != "embedded":
            raise EmbedError("Embedding did not save the passage.")
        if pending_chunk(db, scope) is None:
            return
        query.stage = "Embedding a passage before answering."
        query.status = "running"
        query.error = None
        db.commit()
        return
    visual_ready = bool(visual and getattr(visual, "configured", False))
    if visual_ready:
        outcome = advance_visual(db, store, visual, scope)
        if outcome in {"segmented", "embedded", "skipped"}:
            query = db.get(QueryJob, query_id)
            query.stage = "Indexing a page image before answering."
            query.status = "running"
            db.commit()
            return
    text_ready = bool(embedder and embedder.configured)
    if not text_ready and not visual_ready:
        _persist_pair(db, query, ABSTAIN, [], True)
        return
    question = query.query_text
    if text_ready and not query.query_vector_json:
        db.commit()
        vector = embedder.embed(question, RETRIEVAL_QUERY)
        query = db.get(QueryJob, query_id)
        if query.cancel_requested:
            query.status = "cancelled"
            query.stage = "Cancelled before an answer was saved."
            db.commit()
            return
        query.query_vector_json = json.dumps(vector)
        query.stage = "Searching authorized documents."
        query.status = "running"
        db.commit()
        return
    if visual_ready and not query.visual_vector_json and (query.image_key or _has_current_visual(db, scope)):
        image_key = query.image_key
        db.commit()
        if image_key:
            if store is None:
                raise EmbedError("The query image is no longer available.")
            jpeg, _media = store.get(image_key)
            vector = visual.embed_image(jpeg)
        else:
            vector = visual.embed_text(question)
        query = db.get(QueryJob, query_id)
        if query.cancel_requested:
            query.status = "cancelled"
            query.stage = "Cancelled before an answer was saved."
            db.commit()
            return
        if len(vector) != 768 or getattr(visual, "model_id", None) != VISUAL_MODEL:
            raise EmbedError("Visual embedding returned an incompatible vector.")
        query.visual_vector_json = json.dumps(vector)
        query.stage = "Searching authorized page images."
        query.status = "running"
        db.commit()
        return
    history = _history(db, query.conversation_id)
    user = db.get(User, query.owner_id)
    scope, problem = _scope(db, user, requested)
    if query.cancel_requested:
        query.status = "cancelled"
        query.stage = "Cancelled before an answer was saved."
        db.commit()
        return
    if problem or not scope:
        _persist_pair(db, query, REDACTED if problem else ABSTAIN, [], True)
        return
    evidence = []
    if text_ready and query.query_vector_json:
        for score, chunk, document in search(db, scope, embedder.model_id, json.loads(query.query_vector_json)):
            if can_read(db, user, document) and chunk.state == "current" and chunk.index_version == document.index_version:
                evidence.append(("text", score, chunk, document))
    if visual_ready and query.visual_vector_json:
        for score, region, document in search_visual(db, scope, VISUAL_MODEL, json.loads(query.visual_vector_json)):
            if can_read(db, user, document) and region.state == "current" and document.id in scope:
                evidence.append(("visual", score, region, document))
    text_hits = [item for item in evidence if item[0] == "text"][:3]
    visual_hits = [item for item in evidence if item[0] == "visual"][:2]
    ordered = text_hits + visual_hits
    if not ordered:
        _persist_pair(db, query, ABSTAIN, [], True)
        return
    excerpts = []
    image_attached = False
    for kind, _score, row, document in ordered:
        if kind == "text":
            excerpts.append({"documentId": document.id, "title": document.title, "page": row.page, "text": row.text[:800], "chunkId": row.id})
            continue
        box = (row.x, row.y, row.width, row.height)
        if not valid_region(box):
            continue
        item = {
            "documentId": document.id,
            "title": document.title,
            "page": row.page,
            "text": "Stored page image.",
            "region": [row.x, row.y, row.width, row.height],
            "regionId": row.id,
        }
        if not image_attached and store is not None:
            try:
                jpeg, _media = store.get(row.image_key)
                item["image"] = crop_jpeg(jpeg, box)
                image_attached = True
            except (StorageError, ImageError):
                continue
        elif not image_attached:
            continue
        excerpts.append(item)
    if not excerpts:
        _persist_pair(db, query, ABSTAIN, [], True)
        return
    if not generator or not generator.configured:
        raise GenerateError("Assistant generation is not configured.")
    db.commit()
    parsed = generator.generate(question, excerpts, history)
    for item in excerpts:
        item.pop("image", None)
    query = db.get(QueryJob, query_id)
    user = db.get(User, query.owner_id)
    if query.cancel_requested:
        query.status = "cancelled"
        query.stage = "Cancelled before an answer was saved."
        db.commit()
        return
    scope, problem = _scope(db, user, requested)
    cited = []
    indexes = parsed.get("sourceIndexes") if isinstance(parsed, dict) else None
    if problem or not isinstance(indexes, list) or parsed.get("insufficientEvidence") is True:
        _persist_pair(db, query, REDACTED if problem else ABSTAIN, [], True)
        return
    for index in indexes:
        if not isinstance(index, int) or index < 1 or index > len(excerpts):
            continue
        item = excerpts[index - 1]
        document = db.get(Document, item["documentId"])
        if document is None or not can_read(db, user, document) or document.id not in (scope or []):
            problem = "missing"
            break
        if item.get("regionId"):
            region = db.get(VisualRegion, item["regionId"])
            box = (region.x, region.y, region.width, region.height) if region is not None else None
            if region is None or region.document_id != document.id or region.state != "current" or not valid_region(box):
                problem = "missing"
                break
            cited.append(
                {
                    "documentId": document.id,
                    "title": document.title,
                    "page": region.page,
                    "excerpt": "Stored page image.",
                    "region": [region.x, region.y, region.width, region.height],
                    "regionId": region.id,
                }
            )
            continue
        current = db.get(DocumentChunk, item.get("chunkId"))
        if current is None or current.state != "current" or current.index_version != document.index_version:
            problem = "missing"
            break
        cited.append(
            {
                "documentId": document.id,
                "title": document.title,
                "page": current.page,
                "excerpt": current.text[:500],
                "chunkId": current.id,
            }
        )
    if problem or not cited:
        _persist_pair(db, query, REDACTED if problem else ABSTAIN, [], True)
        return
    answer = str(parsed.get("answer") or "").strip()
    if not answer:
        _persist_pair(db, query, ABSTAIN, [], True)
        return
    _persist_pair(db, query, answer[:8000], cited, False)


@router.post("/assistant/query", status_code=202)
async def ask(
    request: Request,
    query: str = Form(""),
    context: str = Form(""),
    image: UploadFile | None = File(default=None),
):
    actor, denied = mutation_actor(request)
    if denied:
        return denied
    image_bytes = b""
    prepared = None
    if image is not None and image.filename:
        image_bytes = await image.read()
    visual = getattr(request.app.state, "visual", None)
    if image_bytes:
        if visual is None or not getattr(visual, "configured", False):
            return error_response(422, "VALIDATION_ERROR", "Image questions are not available.", request, {"image": "Image questions are not available."})
        if len(image_bytes) > MAX_FILE_BYTES:
            return error_response(413, "PAYLOAD_TOO_LARGE", "The query image exceeds the upload limit.", request)
        try:
            prepared = query_jpeg(image_bytes)
        except ImageError as exc:
            return error_response(422, "VALIDATION_ERROR", str(exc), request, {"image": str(exc)})
    cleaned = query.strip()
    if not cleaned:
        return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request, {"query": "Enter a question."})
    if len(cleaned) > MAX_TEXT_CHARACTERS:
        return error_response(413, "PAYLOAD_TOO_LARGE", "The question is longer than the configured limit.", request)
    parsed = _context(context)
    if parsed is None:
        return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request, {"context": "Context must include conversationId and documentIds."})
    key = request.headers.get("idempotency-key", "").strip()
    if not key or len(key) > 200:
        return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request, {"idempotencyKey": "An Idempotency-Key is required."})
    db = request.state.db
    limited = hit(db, request.app.state.settings, f"query:{actor.user.id}", limit=20)
    if limited:
        return error_response(429, "RATE_LIMITED", "Too many attempts. Wait before trying again.", request, headers={"Retry-After": str(limited)})
    payload_hash = hashlib.sha256(
        json.dumps({"query": cleaned, "context": parsed, "image": hashlib.sha256(image_bytes).hexdigest()}, sort_keys=True).encode()
    ).hexdigest()
    existing = db.scalar(select(QueryJob).where(QueryJob.owner_id == actor.user.id, QueryJob.idem_key == key))
    if existing:
        if existing.payload_hash != payload_hash:
            return error_response(409, "IDEMPOTENCY_CONFLICT", "This Idempotency-Key was already used for a different request.", request)
        return query_out(db, actor.user, existing)
    scope, problem = _scope(db, actor.user, parsed["documentIds"])
    if problem:
        return error_response(404, "NOT_FOUND", "That document is not available.", request)
    conversation = db.get(Conversation, parsed["conversationId"]) if parsed["conversationId"] else None
    if parsed["conversationId"] and (conversation is None or conversation.owner_id != actor.user.id):
        return error_response(404, "NOT_FOUND", "That conversation is not available.", request)
    now = utcnow()
    if conversation is None:
        conversation = Conversation(id=new_id(), owner_id=actor.user.id, title=cleaned[:80], created_at=now, updated_at=now)
        db.add(conversation)
        db.flush()
    job_id = new_id()
    image_key = None
    if prepared:
        image_key = f"q/{job_id}/query.jpg"
        request.app.state.store.put(image_key, prepared, "image/jpeg")
    job = QueryJob(
        id=job_id,
        owner_id=actor.user.id,
        conversation_id=conversation.id,
        status="queued",
        stage="Waiting to answer from authorized documents.",
        step="retrieve",
        idem_key=key,
        payload_hash=payload_hash,
        query_text=cleaned,
        document_ids_json=json.dumps(scope if parsed["documentIds"] else []),
        image_key=image_key,
        image_media="image/jpeg" if image_key else None,
        error=None,
        retryable=False,
        cancel_requested=False,
        created_at=now,
        updated_at=now,
    )
    db.add(job)
    db.flush()
    return query_out(db, actor.user, job)


@router.get("/assistant/queries/{query_id}")
def poll_query(query_id: str, request: Request):
    actor, denied = reader(request)
    if denied:
        return denied
    query = request.state.db.get(QueryJob, query_id)
    if query is None or query.owner_id != actor.user.id:
        return error_response(404, "NOT_FOUND", "That question is not available.", request)
    if query.status in {"queued", "running"} or query.cancel_requested:
        advance_query(
            request.state.db,
            request.app.state.embedder,
            request.app.state.generator,
            query,
            getattr(request.app.state, "visual", None),
            request.app.state.store,
        )
        request.state.db.expire_all()
        query = request.state.db.get(QueryJob, query_id)
    return query_out(request.state.db, request.state.db.get(User, actor.user.id), query)


@router.post("/assistant/queries/{query_id}/cancel")
def cancel_query(query_id: str, request: Request):
    actor, denied = mutation_actor(request)
    if denied:
        return denied
    query = request.state.db.get(QueryJob, query_id)
    if query is None or query.owner_id != actor.user.id:
        return error_response(404, "NOT_FOUND", "That question is not available.", request)
    if query.status == "succeeded":
        return query_out(request.state.db, actor.user, query)
    query.cancel_requested = True
    if query.status in {"queued", "failed"} or query.lease_until is None:
        query.status = "cancelled"
        query.stage = "Cancelled before an answer was saved."
        _drop_query_image(request.app.state.store, query)
        query.updated_at = utcnow()
    return query_out(request.state.db, actor.user, query)


@router.get("/conversations")
def list_conversations(request: Request, page: int = 1, pageSize: int = 20):
    actor, denied = reader(request)
    if denied:
        return denied
    if page < 1 or pageSize < 1 or pageSize > 100:
        return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request)
    db = request.state.db
    message_ids = select(ConversationMessage.conversation_id)
    filters = [Conversation.owner_id == actor.user.id, Conversation.id.in_(message_ids)]
    total = db.scalar(select(func.count()).select_from(Conversation).where(*filters)) or 0
    rows = db.scalars(
        select(Conversation)
        .where(*filters)
        .order_by(Conversation.updated_at.desc(), Conversation.id.desc())
        .offset((page - 1) * pageSize)
        .limit(pageSize)
    ).all()
    return ConversationPage(
        items=[_conversation_out(db, actor.user, row) for row in rows],
        total=int(total),
        page=page,
        pageSize=pageSize,
    )


@router.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: str, request: Request):
    actor, denied = reader(request)
    if denied:
        return denied
    conversation = request.state.db.get(Conversation, conversation_id)
    if conversation is None or conversation.owner_id != actor.user.id:
        return error_response(404, "NOT_FOUND", "That conversation is not available.", request)
    return _conversation_out(request.state.db, actor.user, conversation)
