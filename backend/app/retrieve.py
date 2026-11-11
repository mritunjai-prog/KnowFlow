"""Authorized retrieval. The candidate set is filtered before scoring or prompt construction."""

from __future__ import annotations

import json
import math

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.embeddings import DIMENSION, RETRIEVAL_DOCUMENT
from app.models import Document, DocumentChunk, DocumentGrant, User

MIN_SCORE = 0.35
TOP_K = 5

POSTGRES_SEARCH_SQL = """
SELECT c.id
FROM document_chunks AS c
JOIN documents AS d ON d.id = c.document_id
WHERE c.state = 'current'
  AND c.index_version = d.index_version
  AND c.model_id = :model_id
  AND c.dimension = 768
  AND c.task_type = 'RETRIEVAL_DOCUMENT'
  AND d.id IN :document_ids
  AND (
    d.owner_id = :user_id
    OR d.id IN (
      SELECT document_id FROM document_grants
      WHERE grantee_user_id = :user_id AND status = 'accepted'
    )
  )
ORDER BY c.embedding <=> CAST(:query_vector AS vector)
LIMIT 5
"""


def accessible_ids(db: Session, user: User) -> set[str]:
    shared = select(DocumentGrant.document_id).where(
        DocumentGrant.grantee_user_id == user.id,
        DocumentGrant.status == "accepted",
    )
    rows = db.scalars(select(Document.id).where(or_(Document.owner_id == user.id, Document.id.in_(shared)))).all()
    return set(rows)


def cosine(left: list[float], right: list[float]) -> float:
    if len(left) != len(right) or not left:
        return 0.0
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(b * b for b in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return dot / (left_norm * right_norm)


def search(db: Session, document_ids: list[str], model_id: str, vector: list[float]) -> list[tuple[float, DocumentChunk, Document]]:
    if not document_ids or len(vector) != DIMENSION:
        return []
    rows = db.scalars(
        select(DocumentChunk).where(
            DocumentChunk.document_id.in_(document_ids),
            DocumentChunk.state == "current",
            DocumentChunk.model_id == model_id,
            DocumentChunk.dimension == DIMENSION,
            DocumentChunk.task_type == RETRIEVAL_DOCUMENT,
        )
    ).all()
    scored = []
    for row in rows:
        document = db.get(Document, row.document_id)
        if document is None or document.id not in document_ids or row.index_version != document.index_version:
            continue
        try:
            stored = json.loads(row.embedding_json or "[]")
        except json.JSONDecodeError:
            continue
        score = cosine(vector, stored)
        if score >= MIN_SCORE:
            scored.append((score, row, document))
    scored.sort(key=lambda item: (-item[0], item[1].id))
    return scored[:TOP_K]
