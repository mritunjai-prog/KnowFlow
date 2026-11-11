"""Visual embeddings. A separate 768-d space from gemini-embedding-001 text vectors.

gemini-embedding-2 is the free-tier multimodal model. Its vectors are stored in
visual_regions, never in document_chunks.embedding. Equal dimension is not compatibility.
"""

from __future__ import annotations

import json
from base64 import b64encode

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.embeddings import EmbedError
from app.imaging import ImageError, content_regions, crop_jpeg, valid_region
from app.models import Document, PageImage, VisualRegion
from app.retrieve import MIN_SCORE, cosine
from app.security import new_id, utcnow

VISUAL_MODEL = "gemini-embedding-2"
VISUAL_DIMENSION = 768
VISUAL_VECTOR_SQL = "UPDATE visual_regions SET embedding = CAST(:vec AS vector) WHERE id = :id"


def visual_url() -> str:
    return f"https://generativelanguage.googleapis.com/v1beta/models/{VISUAL_MODEL}:embedContent"


def visual_image_request(jpeg: bytes) -> dict:
    if not jpeg.startswith(b"\xff\xd8"):
        raise EmbedError("Visual embedding accepts a JPEG page or region.")
    return {
        "content": {
            "parts": [
                {
                    "inlineData": {
                        "mimeType": "image/jpeg",
                        "data": b64encode(jpeg).decode("ascii"),
                    }
                }
            ]
        },
        "outputDimensionality": VISUAL_DIMENSION,
    }


def visual_text_request(question: str) -> dict:
    # gemini-embedding-2 does not use taskType. The documented question-answering prefix is the text query.
    return {
        "content": {"parts": [{"text": f"task: question answering | query: {question[:4000]}"}]},
        "outputDimensionality": VISUAL_DIMENSION,
    }


class GeminiVisual:
    configured = True
    model_id = VISUAL_MODEL

    def __init__(self, api_key: str):
        self.api_key = api_key

    def embed_image(self, jpeg: bytes) -> list[float]:
        return _post(self.api_key, visual_image_request(jpeg))

    def embed_text(self, question: str) -> list[float]:
        return _post(self.api_key, visual_text_request(question))


class UnavailableVisual:
    configured = False
    model_id = VISUAL_MODEL

    def embed_image(self, jpeg: bytes) -> list[float]:
        raise EmbedError("Visual embedding is not configured.")

    def embed_text(self, question: str) -> list[float]:
        raise EmbedError("Visual embedding is not configured.")


def build_visual(api_key: str):
    if api_key:
        return GeminiVisual(api_key)
    return UnavailableVisual()


def _post(api_key: str, payload: dict) -> list[float]:
    import httpx

    if "taskType" in payload or "batchEmbedContents" in json.dumps(payload):
        raise EmbedError("The visual embedding request is not approved.")
    try:
        response = httpx.post(visual_url(), params={"key": api_key}, json=payload, timeout=12)
    except httpx.TimeoutException as exc:
        raise EmbedError("Visual embedding timed out. Retry later.", retryable=True) from exc
    except httpx.HTTPError as exc:
        raise EmbedError("Visual embedding is unavailable.", retryable=True) from exc
    if response.status_code == 429:
        raise EmbedError("Visual embedding is rate-limited. Retry later. No paid fallback is available.", retryable=True)
    if response.status_code >= 300:
        raise EmbedError("Visual embedding was rejected by the provider.", retryable=response.status_code >= 500)
    try:
        body = response.json()
        values = body["embedding"]["values"]
    except (KeyError, TypeError, ValueError) as exc:
        raise EmbedError("Visual embedding returned no vector.", retryable=True) from exc
    if not isinstance(values, list) or len(values) != VISUAL_DIMENSION:
        raise EmbedError("Visual embedding returned an incompatible vector.")
    return [float(item) for item in values]


def advance_visual(db: Session, store, visual, document_ids: list[str]) -> str:
    """One local segmentation or one provider embed. Never both."""
    if not document_ids:
        return "complete"
    if visual is None or not getattr(visual, "configured", False):
        return "unavailable"
    if getattr(visual, "model_id", None) != VISUAL_MODEL:
        raise EmbedError("The visual embedding model is not approved.")
    pending = db.scalars(
        select(VisualRegion)
        .where(VisualRegion.document_id.in_(document_ids), VisualRegion.state == "pending")
        .order_by(VisualRegion.created_at, VisualRegion.id)
    ).first()
    if pending is not None:
        return _embed_region(db, store, visual, pending)
    page = _unsegmented_page(db, document_ids)
    if page is not None:
        _segment_page(db, store, page)
        return "segmented"
    return "complete"


def search_visual(db: Session, document_ids: list[str], model_id: str, vector: list[float]):
    if model_id != VISUAL_MODEL or len(vector) != VISUAL_DIMENSION or not document_ids:
        return []
    rows = db.scalars(
        select(VisualRegion).where(
            VisualRegion.document_id.in_(document_ids),
            VisualRegion.state == "current",
            VisualRegion.model_id == VISUAL_MODEL,
            VisualRegion.dimension == VISUAL_DIMENSION,
        )
    ).all()
    scored = []
    for row in rows:
        if not valid_region((row.x, row.y, row.width, row.height)):
            continue
        document = db.get(Document, row.document_id)
        if document is None or document.id not in document_ids:
            continue
        try:
            stored = json.loads(row.embedding_json or "[]")
        except json.JSONDecodeError:
            continue
        if not isinstance(stored, list) or len(stored) != VISUAL_DIMENSION:
            continue
        score = cosine(vector, stored)
        if score >= MIN_SCORE:
            scored.append((score, row, document))
    scored.sort(key=lambda item: (-item[0], item[1].id))
    return scored[:5]


def _embed_region(db: Session, store, visual, region: VisualRegion) -> str:
    region_id = region.id
    image_key = region.image_key
    box = (region.x, region.y, region.width, region.height)
    if not valid_region(box):
        region.state = "failed"
        db.commit()
        raise EmbedError("The stored region is not a normalized box.")
    try:
        jpeg, _media = store.get(image_key)
        crop = crop_jpeg(jpeg, box)
    except ImageError as exc:
        region.state = "failed"
        db.commit()
        raise EmbedError(str(exc)) from exc
    db.commit()
    try:
        vector = visual.embed_image(crop)
    except EmbedError as exc:
        if not exc.retryable:
            current = db.get(VisualRegion, region_id)
            if current is not None and current.state == "pending":
                current.state = "failed"
            db.commit()
        raise
    if len(vector) != VISUAL_DIMENSION:
        current = db.get(VisualRegion, region_id)
        if current is not None and current.state == "pending":
            current.state = "failed"
        db.commit()
        raise EmbedError("Visual embedding returned an incompatible vector.")
    current = db.get(VisualRegion, region_id)
    if current is None or current.state != "pending":
        db.commit()
        return "skipped"
    current.embedding_json = json.dumps(vector)
    current.state = "current"
    current.model_id = VISUAL_MODEL
    current.dimension = VISUAL_DIMENSION
    _write_visual_vector(db, current.id, vector)
    db.commit()
    return "embedded"


def _segment_page(db: Session, store, page: PageImage) -> None:
    try:
        jpeg, _media = store.get(page.image_key)
        boxes = content_regions(jpeg)
    except ImageError as exc:
        raise EmbedError(str(exc)) from exc
    now = utcnow()
    for box in boxes:
        if not valid_region(box):
            continue
        db.add(
            VisualRegion(
                id=new_id(),
                document_id=page.document_id,
                page=page.page,
                image_key=page.image_key,
                x=box[0],
                y=box[1],
                width=box[2],
                height=box[3],
                state="pending",
                created_at=now,
            )
        )
    db.commit()


def _unsegmented_page(db: Session, document_ids: list[str]) -> PageImage | None:
    pages = db.scalars(
        select(PageImage).where(PageImage.document_id.in_(document_ids)).order_by(PageImage.created_at, PageImage.id)
    ).all()
    for page in pages:
        existing = db.scalar(select(VisualRegion.id).where(VisualRegion.image_key == page.image_key))
        if existing is None:
            return page
    return None


def _write_visual_vector(db: Session, region_id: str, values: list[float]) -> None:
    if len(values) != VISUAL_DIMENSION:
        raise EmbedError("Visual embedding returned an incompatible vector.")
    bind = db.get_bind()
    if bind.dialect.name != "postgresql":
        return
    from sqlalchemy import text

    literal = "[" + ",".join(f"{float(item):.8f}" for item in values) + "]"
    db.execute(text(VISUAL_VECTOR_SQL), {"vec": literal, "id": region_id})
