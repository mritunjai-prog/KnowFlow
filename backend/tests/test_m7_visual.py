"""M7 visual retrieval. Fakes only. No Gemini, Groq, R2, or Neon call."""

import json

import cv2
import numpy as np

from app.embeddings import EMBEDDING_MODEL, EmbedError, embedding_request
from app.imaging import content_regions, query_jpeg, valid_region
from app.models import DocumentChunk, DocumentGrant, User, VisualRegion
from app.retrieve import search
from app.security import utcnow
from app.visual import VISUAL_DIMENSION, VISUAL_MODEL, VISUAL_VECTOR_SQL, build_visual, visual_image_request, visual_text_request, visual_url
from tests.helpers import assert_schema, bootstrap, register_and_verify

PASSWORD = "correct-horse-1"
META = {
    "title": "Board photo",
    "tags": ["networks"],
    "documentType": "lecture note",
    "meetingId": None,
    "meetingTitle": None,
    "occurredAt": None,
    "captureSource": "file",
    "modelId": None,
}


class TextEmbedder:
    configured = True
    model_id = "fake-embed-768"

    def embed(self, text: str, task_type: str) -> list[float]:
        vector = [0.0] * 768
        folded = text.lower()
        if "packet" in folded or "routing" in folded:
            vector[0] = 1.0
        elif "invoice" in folded or "payment" in folded:
            vector[1] = 1.0
        elif "attendance" in folded:
            vector[2] = 1.0
        else:
            vector[3] = 1.0
        return vector


class VisualEmbedder:
    configured = True
    model_id = VISUAL_MODEL

    def __init__(self):
        self.image_calls = 0
        self.text_calls = 0

    def embed_image(self, jpeg: bytes) -> list[float]:
        self.image_calls += 1
        vector = [0.0] * VISUAL_DIMENSION
        image = cv2.imdecode(np.frombuffer(jpeg, dtype=np.uint8), cv2.IMREAD_COLOR)
        if image is None:
            vector[7] = 1.0
            return vector
        red = np.logical_and(image[:, :, 2] > 180, image[:, :, 1] < 80)
        blue = np.logical_and(image[:, :, 0] > 180, image[:, :, 2] < 80)
        if red.any():
            vector[4] = 1.0
        elif blue.any():
            vector[5] = 1.0
        else:
            vector[6] = 1.0
        return vector

    def embed_text(self, question: str) -> list[float]:
        self.text_calls += 1
        vector = [0.0] * VISUAL_DIMENSION
        vector[6] = 1.0
        return vector


class RecordingGenerator:
    configured = True

    def __init__(self):
        self.ids = []
        self.regions = []

    def generate(self, question: str, excerpts: list[dict], history: list[str]) -> dict:
        self.ids = [item["documentId"] for item in excerpts]
        self.regions = [item.get("region") for item in excerpts]
        for index, item in enumerate(excerpts, start=1):
            if item.get("region"):
                return {"answer": "The mark is on the stored page.", "insufficientEvidence": False, "sourceIndexes": [index]}
            if "packet" in item["text"].lower():
                return {"answer": "Supported by the text excerpt.", "insufficientEvidence": False, "sourceIndexes": [index]}
        return {"answer": "", "insufficientEvidence": True, "sourceIndexes": []}


class Transcriber:
    configured = True

    def transcribe(self, jpeg: bytes) -> str:
        assert jpeg.startswith(b"\xff\xd8")
        return "Attendance roster only."


def login(client, email="ada@example.com"):
    bootstrap(client)
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200, response.text
    client.headers["X-CSRF-Token"] = response.json()["csrfToken"]
    return response


def finish(client, job_id, limit=24):
    body = None
    for _ in range(limit):
        response = client.get(f"/api/v1/jobs/{job_id}")
        assert response.status_code == 200, response.text
        body = response.json()
        if body["status"] in {"succeeded", "failed", "cancelled"}:
            return body
    raise AssertionError(body)


def poll_until(client, query_id, limit=16):
    body = None
    for _ in range(limit):
        response = client.get(f"/api/v1/assistant/queries/{query_id}")
        assert response.status_code == 200, response.text
        body = response.json()
        if body["status"] in {"succeeded", "failed", "cancelled"}:
            return body
    raise AssertionError(body)


def ask(client, query, document_ids=None, key="ask-1", image=None):
    context = {"conversationId": None, "documentIds": document_ids or []}
    files = {"image": image} if image else None
    return client.post(
        "/api/v1/assistant/query",
        data={"query": query, "context": json.dumps(context)},
        files=files,
        headers={"Idempotency-Key": key},
    )


def png_bytes(image) -> bytes:
    ok, encoded = cv2.imencode(".png", image)
    assert ok
    return encoded.tobytes()


def red_page() -> bytes:
    page = np.full((600, 800, 3), 245, np.uint8)
    cv2.rectangle(page, (80, 70), (280, 230), (0, 0, 220), -1)
    return png_bytes(page)


def blue_page() -> bytes:
    page = np.full((600, 800, 3), 245, np.uint8)
    cv2.rectangle(page, (400, 300), (620, 520), (220, 0, 0), -1)
    return png_bytes(page)


def red_query() -> tuple[str, bytes, str]:
    square = np.full((64, 64, 3), (0, 0, 220), np.uint8)
    return ("mark.png", png_bytes(square), "image/png")


def ingest_image(client, data: bytes, key: str, name="board.png"):
    return client.post(
        "/api/v1/ingestions",
        data={"text": "", "metadata": json.dumps(META)},
        files=[("files", (name, data, "image/png"))],
        headers={"Idempotency-Key": key},
    )


def test_visual_requests_stay_in_their_own_space():
    image = visual_image_request(b"\xff\xd8\xff")
    text = visual_text_request("Where is the mark?")
    assert visual_url().endswith(f"/models/{VISUAL_MODEL}:embedContent")
    assert VISUAL_MODEL != EMBEDDING_MODEL
    assert "taskType" not in image
    assert "taskType" not in text
    assert image["outputDimensionality"] == 768
    assert text["content"]["parts"][0]["text"].startswith("task: question answering | query: ")
    assert "batchEmbedContents" not in json.dumps(image)
    assert "document_chunks" not in VISUAL_VECTOR_SQL
    assert "visual_regions" in VISUAL_VECTOR_SQL
    text_request = embedding_request("Attendance roster only.", "RETRIEVAL_DOCUMENT")
    assert text_request["taskType"] == "RETRIEVAL_DOCUMENT"
    assert "inlineData" not in json.dumps(text_request)
    assert build_visual("").configured is False
    assert build_visual("test-key").model_id == VISUAL_MODEL


def test_region_boxes_are_normalized_to_the_stored_page():
    page = np.full((600, 800, 3), 245, np.uint8)
    cv2.rectangle(page, (80, 70), (280, 230), (0, 0, 220), -1)
    ok, encoded = cv2.imencode(".jpg", page)
    assert ok
    regions = content_regions(encoded.tobytes())
    assert regions
    assert all(valid_region(item) for item in regions)
    assert not valid_region([0, 0, 1.2, 1])
    assert not valid_region([0.2, 0.2])
    overlap = [item for item in regions if item[2] < 0.95 and _overlaps(item, (80 / 800, 70 / 600, 200 / 800, 160 / 600))]
    assert overlap, regions
    prepared = query_jpeg(red_page())
    assert prepared.startswith(b"\xff\xd8")


def test_adapter_stops_on_rate_limit_without_a_paid_model(monkeypatch):
    class Response:
        def __init__(self, status_code, body):
            self.status_code = status_code
            self._body = body

        def json(self):
            return self._body

    calls = []

    def post(url, params=None, json=None, timeout=None):
        calls.append(url)
        return Response(429, {})

    monkeypatch.setattr("httpx.post", post)
    try:
        build_visual("test-key").embed_image(b"\xff\xd8\xff")
    except EmbedError as exc:
        assert exc.retryable
        assert "paid" in str(exc).lower()
    else:
        raise AssertionError("rate limit was not reported")
    assert calls and "batchEmbedContents" not in calls[0]
    assert VISUAL_MODEL in calls[0]

    def short(url, params=None, json=None, timeout=None):
        return Response(200, {"embedding": {"values": [0.1, 0.2]}})

    monkeypatch.setattr("httpx.post", short)
    try:
        build_visual("test-key").embed_text("Where?")
    except EmbedError as exc:
        assert exc.retryable is False
    else:
        raise AssertionError("short vector was stored")


def test_image_query_finds_the_page_ocr_text_misses(client, app, caplog):
    visual = VisualEmbedder()
    generator = RecordingGenerator()
    app.state.transcriber = Transcriber()
    app.state.embedder = TextEmbedder()
    hidden = client.get("/api/v1/capabilities")
    assert hidden.json()["multimodal"] is False
    app.state.visual = visual
    app.state.generator = generator
    hidden = client.get("/api/v1/capabilities")
    assert hidden.json()["multimodal"] is True
    assert all(item["id"] != VISUAL_MODEL or item["available"] is False for item in hidden.json()["models"])
    register_and_verify(client, caplog)
    login(client)
    created = ingest_image(client, red_page(), "red-page")
    assert created.status_code == 202, created.text
    assert visual.image_calls == 0
    done = finish(client, created.json()["id"])
    assert done["status"] == "succeeded", done
    red_id = done["items"][0]["documentId"]
    decoy = ingest_image(client, blue_page(), "blue-page", name="other.png")
    decoy_done = finish(client, decoy.json()["id"])
    assert decoy_done["status"] == "succeeded"
    blue_id = decoy_done["items"][0]["documentId"]
    invoice = client.post(
        "/api/v1/ingestions",
        data={"text": "Invoice payment is due Friday.", "metadata": json.dumps({**META, "title": "Invoice"})},
        headers={"Idempotency-Key": "invoice"},
    )
    assert finish(client, invoice.json()["id"])["status"] == "succeeded"
    db = app.state.sessionmaker()
    try:
        chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == red_id).all()
        regions = db.query(VisualRegion).filter(VisualRegion.document_id == red_id, VisualRegion.state == "current").all()
        assert chunks and regions
        assert chunks[0].model_id == "fake-embed-768"
        assert regions[0].model_id == VISUAL_MODEL
        assert chunks[0].embedding_json != regions[0].embedding_json
        assert "attendance" in chunks[0].text.lower()
        assert "mark" not in chunks[0].text.lower()
        question = TextEmbedder().embed("Where is this mark?", "RETRIEVAL_QUERY")
        assert search(db, [red_id], "fake-embed-768", question) == []
    finally:
        db.close()
    calls_before = visual.image_calls
    created_query = ask(client, "Where is this mark?", key="visual-ask", image=red_query())
    assert created_query.status_code == 202, created_query.text
    assert visual.image_calls == calls_before
    finished = poll_until(client, created_query.json()["id"])
    assert finished["status"] == "succeeded", finished
    answer = finished["answer"]["answer"]
    assert answer["insufficientEvidence"] is False
    assert answer["sources"][0]["documentId"] == red_id
    assert answer["sources"][0]["page"] == 1
    assert valid_region(answer["sources"][0]["region"])
    assert _overlaps(answer["sources"][0]["region"], (80 / 800, 70 / 600, 200 / 800, 160 / 600))
    assert red_id in generator.ids
    assert blue_id not in generator.ids
    history = client.get(f"/api/v1/conversations/{finished['conversationId']}")
    assert_schema(history.json(), "Conversation")
    patched = client.patch(f"/api/v1/documents/{red_id}", json={"text": "Corrected attendance note."})
    assert patched.status_code == 200, patched.text
    edited = poll_until(client, ask(client, "Where is this mark?", key="after-edit", image=red_query()).json()["id"])
    assert edited["answer"]["answer"]["sources"][0]["documentId"] == red_id
    assert valid_region(edited["answer"]["answer"]["sources"][0]["region"])
    documents = client.get("/api/v1/documents").json()["items"]
    invoice_id = next(item["id"] for item in documents if item["title"] == "Invoice")
    restricted = ask(client, "Where is this mark?", document_ids=[invoice_id], key="restricted", image=red_query())
    assert restricted.status_code == 202, restricted.text
    missed = poll_until(client, restricted.json()["id"])
    assert missed["answer"]["answer"]["insufficientEvidence"] is True
    assert missed["answer"]["answer"]["sources"] == []
    assert red_id not in missed["answer"]["answer"]["text"]


def test_visual_retrieval_respects_grants_and_abstains(client, app, caplog):
    visual = VisualEmbedder()
    app.state.transcriber = Transcriber()
    app.state.embedder = TextEmbedder()
    app.state.visual = visual
    app.state.generator = RecordingGenerator()
    register_and_verify(client, caplog, email="ada@example.com")
    register_and_verify(client, caplog, email="bea@example.com", name="Bea")
    register_and_verify(client, caplog, email="cy@example.com", name="Cy")
    login(client, "ada@example.com")
    created = ingest_image(client, red_page(), "shared-page")
    done = finish(client, created.json()["id"])
    red_id = done["items"][0]["documentId"]
    login(client, "cy@example.com")
    denied = ask(client, "Where is this mark?", document_ids=[red_id], key="outsider", image=red_query())
    assert denied.status_code == 404
    session = app.state.sessionmaker()
    try:
        bea = session.query(User).filter(User.email == "bea@example.com").one()
        session.add(
            DocumentGrant(
                id="grant-visual",
                document_id=red_id,
                grantee_email="bea@example.com",
                grantee_user_id=bea.id,
                permission="view",
                status="accepted",
                created_at=utcnow(),
            )
        )
        session.commit()
    finally:
        session.close()
    login(client, "bea@example.com")
    allowed = poll_until(client, ask(client, "Where is this mark?", key="bea-visual", image=red_query()).json()["id"])
    assert allowed["answer"]["answer"]["sources"][0]["documentId"] == red_id
    assert valid_region(allowed["answer"]["answer"]["sources"][0]["region"])
    revoked = app.state.sessionmaker()
    try:
        grant = revoked.get(DocumentGrant, "grant-visual")
        grant.status = "revoked"
        revoked.commit()
    finally:
        revoked.close()
    history = client.get(f"/api/v1/conversations/{allowed['conversationId']}")
    assert history.json()["messages"][-1]["sources"] == []
    assert history.json()["messages"][-1]["insufficientEvidence"] is True
    assert "region" not in history.text
    unrelated = poll_until(client, ask(client, "Where is this mark?", key="blue-query", image=("mark.png", blue_page(), "image/png")).json()["id"])
    assert unrelated["answer"]["answer"]["insufficientEvidence"] is True
    assert unrelated["answer"]["answer"]["sources"] == []


def test_capabilities_image_rejection_and_cancel(client, app, caplog):
    app.state.embedder = TextEmbedder()
    app.state.transcriber = Transcriber()
    before = client.get("/api/v1/capabilities")
    assert before.json()["multimodal"] is False
    visual = VisualEmbedder()
    app.state.visual = visual
    after = client.get("/api/v1/capabilities")
    assert after.json()["multimodal"] is True
    register_and_verify(client, caplog)
    login(client)
    rejected = ask(client, "Look", key="bad-image", image=("page.jpg", b"not-an-image", "image/jpeg"))
    assert rejected.status_code == 422
    assert visual.image_calls == 0
    created = ask(client, "Where is this mark?", key="cancel-image", image=red_query())
    assert created.status_code == 202, created.text
    assert visual.image_calls == 0
    cancelled = client.post(f"/api/v1/assistant/queries/{created.json()['id']}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    assert visual.image_calls == 0
    replay = ask(client, "Where is this mark?", key="cancel-image", image=red_query())
    assert replay.status_code == 202
    assert replay.json()["id"] == created.json()["id"]
    mismatch = ask(client, "Where is this mark?", key="cancel-image", image=("mark.png", blue_page(), "image/png"))
    assert mismatch.status_code == 409

    class Limited:
        configured = True
        model_id = VISUAL_MODEL

        def embed_image(self, jpeg: bytes) -> list[float]:
            raise EmbedError("Visual embedding is rate-limited. Retry later. No paid fallback is available.", retryable=True)

        def embed_text(self, question: str) -> list[float]:
            raise EmbedError("Visual embedding is rate-limited. Retry later. No paid fallback is available.", retryable=True)

    note = client.post(
        "/api/v1/ingestions",
        data={"text": "Attendance roster only.", "metadata": json.dumps({**META, "title": "Notes"})},
        headers={"Idempotency-Key": "notes"},
    )
    assert finish(client, note.json()["id"])["status"] == "succeeded"
    app.state.visual = Limited()
    failed = poll_until(client, ask(client, "Where is this mark?", key="limited", image=red_query()).json()["id"])
    assert failed["status"] == "failed"
    assert failed["error"]
    assert "paid" in failed["error"].lower()
    assert failed["answer"] is None


def _overlaps(region, expected) -> bool:
    ax, ay, aw, ah = region
    bx, by, bw, bh = expected
    ix = max(0.0, min(ax + aw, bx + bw) - max(ax, bx))
    iy = max(0.0, min(ay + ah, by + bh) - max(ay, by))
    return ix * iy > 0
