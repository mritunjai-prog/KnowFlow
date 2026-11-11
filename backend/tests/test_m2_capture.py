import io
import json
from datetime import timedelta

from tests.helpers import assert_schema, bootstrap, register_and_verify

PASSWORD = "correct-horse-1"
META = {
    "title": "Lecture 1",
    "tags": ["networks"],
    "documentType": "lecture note",
    "meetingId": None,
    "meetingTitle": None,
    "occurredAt": None,
    "captureSource": "file",
    "modelId": None,
}


def login(client, email="ada@example.com"):
    bootstrap(client)
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200, response.text
    client.headers["X-CSRF-Token"] = response.json()["csrfToken"]
    return response


def ingest(client, text="Synthetic note about packets.", files=None, metadata=None, key="batch-1"):
    data = {"text": text, "metadata": json.dumps(metadata or META)}
    response = client.post(
        "/api/v1/ingestions",
        data=data,
        files=files or [],
        headers={"Idempotency-Key": key},
    )
    return response


def finish(client, job_id, limit=8):
    body = None
    for _ in range(limit):
        response = client.get(f"/api/v1/jobs/{job_id}")
        assert response.status_code == 200, response.text
        body = response.json()
        assert_schema(body, "Job")
        if body["status"] in {"succeeded", "failed", "cancelled"}:
            return body
    raise AssertionError(body)


def test_text_reaches_library_timeline_and_survives_restart(database_url, caplog):
    import logging

    from fastapi.testclient import TestClient

    from app.config import get_settings
    from app.main import create_app

    get_settings.cache_clear()
    first = create_app()
    logging.getLogger("knowflow.verification").addHandler(caplog.handler)
    with TestClient(first) as client:
        client.headers["Origin"] = "http://test.example"
        register_and_verify(client, caplog)
        login(client)
        created = ingest(client)
        assert created.status_code == 202, created.text
        job_id = created.json()["id"]
        assert created.json()["status"] == "queued"
    first.state.engine.dispose()

    get_settings.cache_clear()
    restarted = create_app()
    with TestClient(restarted) as client:
        client.headers["Origin"] = "http://test.example"
        login(client)
        done = finish(client, job_id)
        assert done["status"] == "succeeded"
        assert done["items"][0]["documentId"]
        document_id = done["items"][0]["documentId"]
        document = client.get(f"/api/v1/documents/{document_id}")
        assert document.status_code == 200, document.text
        assert_schema(document.json(), "DocumentRecord")
        assert document.json()["text"] == "Synthetic note about packets."
        assert document.json()["permission"] == "owner"
        library = client.get("/api/v1/documents")
        assert library.json()["total"] == 1
        assert_schema(library.json(), "PageDocumentRecord")
        timeline = client.get("/api/v1/timeline", params={"timezone": "Asia/Kolkata"})
        assert timeline.status_code == 200, timeline.text
        assert_schema(timeline.json(), "PageTimelineEvent")
        assert timeline.json()["items"][0]["source"]["documentId"] == document_id
        changed = client.patch(f"/api/v1/documents/{document_id}", json={"text": "Corrected packet note"})
        assert changed.status_code == 200
        assert changed.json()["text"] == "Corrected packet note"
    restarted.state.engine.dispose()
    logging.getLogger("knowflow.verification").removeHandler(caplog.handler)


def test_partial_batch_idempotency_and_ownership(client, caplog):
    register_and_verify(client, caplog)
    login(client)
    files = [
        ("files", ("notes.txt", b"Local plain text.", "text/plain")),
        ("files", ("broken.bin", b"\x00\x01not-a-document", "application/octet-stream")),
    ]
    created = ingest(client, text="", files=files, key="mixed-1")
    assert created.status_code == 202, created.text
    done = finish(client, created.json()["id"])
    assert done["status"] == "succeeded"
    assert [item["status"] for item in done["items"]] == ["succeeded", "failed"]
    assert "not supported" in done["items"][1]["error"]
    replay = ingest(client, text="", files=files, key="mixed-1")
    assert replay.status_code == 202
    assert replay.json()["id"] == created.json()["id"]
    assert client.get("/api/v1/documents").json()["total"] == 1
    mismatch = ingest(client, text="different", files=files, key="mixed-1")
    assert mismatch.status_code == 409
    assert mismatch.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"
    client.cookies.clear()
    register_and_verify(client, caplog, email="other@example.com", name="Other")
    login(client, email="other@example.com")
    hidden = client.get(f"/api/v1/documents/{done['items'][0]['documentId']}")
    assert hidden.status_code == 404
    assert client.get("/api/v1/documents").json()["total"] == 0
    assert client.get(f"/api/v1/jobs/{created.json()['id']}").status_code == 404


def test_image_pipeline_is_explicit_and_one_step_per_poll(client, app, caplog):
    import cv2
    import numpy as np

    class Fake:
        configured = True

        def __init__(self):
            self.calls = 0

        def transcribe(self, jpeg: bytes) -> str:
            self.calls += 1
            assert jpeg.startswith(b"\xff\xd8")
            return "Handwritten: packet loss"

    app.state.transcriber = Fake()
    register_and_verify(client, caplog)
    login(client)
    page = np.full((600, 800, 3), 25, np.uint8)
    cv2.rectangle(page, (70, 50), (730, 540), (250, 250, 250), -1)
    ok, encoded = cv2.imencode(".png", page)
    assert ok
    created = ingest(
        client,
        text="",
        files=[("files", ("page.png", encoded.tobytes(), "image/png"))],
        key="image-1",
    )
    assert created.status_code == 202, created.text
    first = client.get(f"/api/v1/jobs/{created.json()['id']}")
    assert first.json()["status"] == "running"
    assert first.json()["items"][0]["documentId"] is None
    second = finish(client, created.json()["id"])
    assert second["status"] == "succeeded"
    assert app.state.transcriber.calls == 1
    document = client.get(f"/api/v1/documents/{second['items'][0]['documentId']}").json()
    assert document["sourceType"] == "scanned"
    assert document["text"] == "Handwritten: packet loss"
    assert document["processed"]["mediaType"] == "image/jpeg"
    assert document["thumbnailUrl"].startswith("/api/v1/files/")
    original = client.get(document["original"]["url"])
    assert original.status_code == 200
    assert original.headers["content-type"].startswith("image/")
    flat = np.full((200, 200, 3), 120, np.uint8)
    ok, flat_encoded = cv2.imencode(".png", flat)
    app.state.transcriber = Fake()
    created = ingest(client, text="", files=[("files", ("flat.png", flat_encoded.tobytes(), "image/png"))], key="image-2")
    done = finish(client, created.json()["id"])
    note = client.get(f"/api/v1/documents/{done['items'][0]['documentId']}").json()["summary"]
    assert "No document boundary" in note


def test_cancel_keeps_completed_work_and_retry_does_not_duplicate(client, caplog):
    register_and_verify(client, caplog)
    login(client)
    files = [
        ("files", ("notes.txt", b"Keep this.", "text/plain")),
        ("files", ("broken.bin", b"\x00nope", "application/octet-stream")),
    ]
    created = ingest(client, text="", files=files, key="cancel-1")
    finish(client, created.json()["id"])
    before = client.get("/api/v1/documents").json()["total"]
    retry = client.post(f"/api/v1/jobs/{created.json()['id']}/retry")
    assert retry.status_code == 202
    again = finish(client, created.json()["id"])
    assert again["items"][0]["status"] == "succeeded"
    assert again["items"][1]["status"] == "failed"
    assert client.get("/api/v1/documents").json()["total"] == before
    queued = ingest(client, key="cancel-2")
    cancelled = client.post(f"/api/v1/jobs/{queued.json()['id']}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    assert client.post(f"/api/v1/jobs/{queued.json()['id']}/cancel").status_code == 200
    assert client.post(f"/api/v1/jobs/{queued.json()['id']}/retry").status_code == 409


def test_expired_signed_url_and_lease(client, app, caplog):
    from app.security import utcnow

    register_and_verify(client, caplog)
    login(client)
    created = ingest(client, key="lease-1")
    job_id = created.json()["id"]
    db = app.state.sessionmaker()
    job = db.get(__import__("app.models", fromlist=["Job"]).Job, job_id)
    job.lease_until = utcnow() + timedelta(hours=1)
    job.status = "running"
    db.commit()
    db.close()
    held = client.get(f"/api/v1/jobs/{job_id}")
    assert held.json()["status"] == "running"
    assert held.json()["items"][0]["documentId"] is None
    db = app.state.sessionmaker()
    job = db.get(__import__("app.models", fromlist=["Job"]).Job, job_id)
    job.lease_until = utcnow() - timedelta(seconds=5)
    db.commit()
    db.close()
    done = finish(client, job_id)
    document = client.get(f"/api/v1/documents/{done['items'][0]['documentId']}").json()
    token = document["thumbnailUrl"]
    assert token is None or token.startswith("/api/v1/files/")
    from app.storage import LocalStore

    store = app.state.store
    assert isinstance(store, LocalStore)
    signed = store.signed_url("missing", "file.txt", "text/plain", expires_in=-1)
    assert client.get(signed).status_code == 404


def test_transcription_request_has_no_tools():
    from app.transcribe import PINNED_MODEL, transcription_request

    body = transcription_request(b"\xff\xd8\xff\x00")
    assert PINNED_MODEL == "gemini-3.8-flash"
    assert "tools" not in body
    assert "google_search" not in json.dumps(body)
    assert body["contents"][0]["parts"][1]["inline_data"]["mime_type"] == "image/jpeg"


def test_r2_url_is_signed_without_a_network_call():
    from app.config import Settings
    from app.storage import presign_r2_get

    settings = Settings.model_construct(
        r2_account_id="abc123",
        r2_access_key_id="key",
        r2_secret_access_key="secret",
        r2_bucket="knowflow",
    )
    url = presign_r2_get(settings, "q/job/item", expires_in=60)
    assert url.startswith("https://abc123.r2.cloudflarestorage.com/knowflow/")
    assert "X-Amz-Signature=" in url
    assert "X-Amz-Expires=60" in url
