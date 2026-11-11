"""Chunk storage and one-chunk embedding. Stale chunks are never searchable."""

from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.chunking import chunk_document
from app.embeddings import DIMENSION, RETRIEVAL_DOCUMENT
from app.models import Document, DocumentChunk, Job, JobItem
from app.security import new_id, utcnow


def chunks_for(db: Session, document_id: str) -> list[DocumentChunk]:
    return list(
        db.scalars(
            select(DocumentChunk).where(DocumentChunk.document_id == document_id).order_by(DocumentChunk.position, DocumentChunk.id)
        )
    )


def sync_chunks(db: Session, document: Document, text_changed: bool, queue: bool = True) -> None:
    rows = chunks_for(db, document.id)
    if not text_changed:
        for row in rows:
            if row.state == "current":
                row.index_version = document.index_version
        return
    for row in rows:
        row.state = "stale"
    for position, piece in enumerate(chunk_document(document.text or "")):
        db.add(
            DocumentChunk(
                id=new_id(),
                document_id=document.id,
                position=position,
                page=piece["page"],
                text=piece["text"],
                state="pending",
                index_version=document.index_version,
                model_id=None,
                task_type=None,
                dimension=None,
                embedding_json=None,
                created_at=utcnow(),
            )
        )
    if queue:
        queue_index_job(db, document)


def queue_index_job(db: Session, document: Document) -> Job:
    existing = db.scalars(select(Job).where(Job.owner_id == document.owner_id, Job.status.in_(("queued", "running")))).all()
    for job in existing:
        try:
            meta = json.loads(job.payload_json or "{}")
        except json.JSONDecodeError:
            continue
        if meta.get("kind") == "index" and meta.get("documentId") == document.id:
            return job
    now = utcnow()
    job = Job(
        id=new_id(),
        owner_id=document.owner_id,
        status="queued",
        created_at=now,
        updated_at=now,
        stage="Waiting to reindex the corrected text.",
        progress=0,
        error=None,
        retryable=False,
        meeting_id=None,
        cancel_requested=False,
        payload_json=json.dumps({"kind": "index", "documentId": document.id}),
    )
    db.add(job)
    db.flush()
    db.add(
        JobItem(
            id=new_id(),
            job_id=job.id,
            position=0,
            name="Reindex",
            status="queued",
            document_id=document.id,
            kind="index",
            step="embed",
            partial_text="",
        )
    )
    return job


def pending_chunk(db: Session, document_ids: list[str]) -> DocumentChunk | None:
    if not document_ids:
        return None
    rows = db.scalars(
        select(DocumentChunk)
        .where(DocumentChunk.document_id.in_(document_ids), DocumentChunk.state == "pending")
        .order_by(DocumentChunk.created_at, DocumentChunk.id)
    ).all()
    for row in rows:
        document = db.get(Document, row.document_id)
        if document is not None and row.index_version == document.index_version:
            return row
    return None


def embed_next_chunk(db: Session, embedder, document: Document) -> str:
    """Embed one current-version chunk. Returns embedded, complete, or skipped.

    The vector write, or the missing-key failure, is committed before return so a
    poll cannot answer from the pre-write session state.
    """
    from app.embeddings import EmbedError

    if embedder is None or not getattr(embedder, "configured", False):
        document.index_state = "pending"
        db.commit()
        raise EmbedError("Embedding is not configured.")
    row = pending_chunk(db, [document.id])
    if row is None:
        _mark_ready(db, document)
        db.commit()
        return "complete"
    chunk_id = row.id
    document_id = document.id
    version = row.index_version
    text = row.text
    db.commit()
    try:
        vector = embedder.embed(text, RETRIEVAL_DOCUMENT)
    except EmbedError:
        raise
    except Exception as exc:
        raise EmbedError("Embedding is unavailable.", retryable=True) from exc
    if not isinstance(vector, list) or len(vector) != DIMENSION:
        raise EmbedError("Embedding returned an incompatible vector.")
    chunk = db.get(DocumentChunk, chunk_id)
    document = db.get(Document, document_id)
    if chunk is None or document is None or chunk.index_version != document.index_version or chunk.index_version != version:
        db.commit()
        return "skipped"
    chunk.embedding_json = json.dumps(vector)
    chunk.state = "current"
    chunk.model_id = getattr(embedder, "model_id", None)
    chunk.task_type = RETRIEVAL_DOCUMENT
    chunk.dimension = DIMENSION
    _write_pgvector(db, chunk.id, vector)
    _mark_ready(db, document)
    db.commit()
    return "embedded"


def _mark_ready(db: Session, document: Document) -> None:
    if pending_chunk(db, [document.id]) is None:
        document.index_state = "current"


def _write_pgvector(db: Session, chunk_id: str, values: list[float]) -> None:
    bind = db.get_bind()
    if bind.dialect.name != "postgresql":
        return
    from sqlalchemy import text

    literal = "[" + ",".join(f"{float(item):.8f}" for item in values) + "]"
    db.execute(text("UPDATE document_chunks SET embedding = CAST(:vec AS vector) WHERE id = :id"), {"vec": literal, "id": chunk_id})
