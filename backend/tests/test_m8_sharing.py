"""M8 selected-document sharing. No provider calls."""

import json
from datetime import timedelta

from app.embeddings import RETRIEVAL_DOCUMENT, RETRIEVAL_QUERY
from app.identity import promote_configured_admins
from app.models import DocumentGrant
from app.security import utcnow
from tests.helpers import assert_schema, bootstrap, register_and_verify

PASSWORD = "correct-horse-1"
SECRET = "The packet routing secret is amber."
SIBLING = "Sibling private note zeta."


class FakeEmbedder:
    configured = True
    model_id = "fake-embed-768"

    def embed(self, text: str, task_type: str) -> list[float]:
        assert task_type in {RETRIEVAL_DOCUMENT, RETRIEVAL_QUERY}
        vector = [0.0] * 768
        vector[0] = 1.0 if "packet" in text.lower() or "amber" in text.lower() or "routed" in text.lower() else 0.0
        if vector[0] == 0.0:
            vector[1] = 1.0
        return vector


class FakeGenerator:
    configured = True

    def generate(self, question: str, excerpts: list[dict], history: list[str]) -> dict:
        for index, item in enumerate(excerpts, start=1):
            if "amber" in item["text"].lower():
                return {"answer": "The secret is amber.", "insufficientEvidence": False, "sourceIndexes": [index]}
        return {"answer": "", "insufficientEvidence": True, "sourceIndexes": []}


def login(client, email):
    bootstrap(client)
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200, response.text
    client.headers["X-CSRF-Token"] = response.json()["csrfToken"]
    return response


def meta(title, meeting_id=None):
    return {
        "title": title,
        "tags": ["networks"],
        "documentType": "lecture note",
        "meetingId": meeting_id,
        "meetingTitle": None,
        "occurredAt": None,
        "captureSource": "text",
        "modelId": None,
    }


def ingest(client, text, key, title, meeting_id=None):
    response = client.post(
        "/api/v1/ingestions",
        data={"text": text, "metadata": json.dumps(meta(title, meeting_id))},
        headers={"Idempotency-Key": key},
    )
    assert response.status_code == 202, response.text
    return response.json()["id"]


def finish(client, job_id, limit=12):
    body = None
    for _ in range(limit):
        response = client.get(f"/api/v1/jobs/{job_id}")
        assert response.status_code == 200, response.text
        body = response.json()
        if body["status"] in {"succeeded", "failed", "cancelled"}:
            return body
    raise AssertionError(body)


def poll(client, query_id, limit=8):
    body = None
    for _ in range(limit):
        response = client.get(f"/api/v1/assistant/queries/{query_id}")
        assert response.status_code == 200, response.text
        body = response.json()
        if body["status"] in {"succeeded", "failed", "cancelled"}:
            return body
    raise AssertionError(body)


def test_owner_invites_and_only_the_verified_recipient_can_accept(client, app, caplog):
    register_and_verify(client, caplog, email="ada@example.com", name="Ada")
    register_and_verify(client, caplog, email="bea@example.com", name="Bea")
    register_and_verify(client, caplog, email="cy@example.com", name="Cy")
    register_and_verify(client, caplog, email="admin@example.com", name="Admin")
    db = app.state.sessionmaker()
    try:
        promote_configured_admins(db, app.state.settings)
        db.commit()
    finally:
        db.close()
    login(client, "ada@example.com")
    meeting = client.post("/api/v1/meetings", json={"title": "Sync", "occurredAt": "2026-11-11T12:00:00+00:00"})
    assert meeting.status_code == 201, meeting.text
    meeting_id = meeting.json()["id"]
    uploaded = client.post(
        "/api/v1/ingestions",
        data={"text": "", "metadata": json.dumps(meta("Shared note", meeting_id))},
        files=[("files", ("notes.txt", SECRET.encode(), "text/plain"))],
        headers={"Idempotency-Key": "shared"},
    )
    assert uploaded.status_code == 202, uploaded.text
    shared_job = uploaded.json()["id"]
    sibling_job = ingest(client, SIBLING, "sibling", "Sibling note", meeting_id)
    assert finish(client, shared_job)["status"] == "succeeded"
    assert finish(client, sibling_job)["status"] == "succeeded"
    documents = client.get("/api/v1/documents").json()["items"]
    shared = next(item for item in documents if item["title"] == "Shared note")
    sibling = next(item for item in documents if item["title"] == "Sibling note")
    task = client.post(
        "/api/v1/tasks",
        json={"description": "Owner only task", "priority": "medium", "dueDate": None, "sourceDocumentId": shared["id"]},
    )
    assert task.status_code == 201, task.text
    self_share = client.post(f"/api/v1/documents/{shared['id']}/shares", json={"email": "Ada@Example.com", "permission": "view"})
    assert self_share.status_code == 409
    created = client.post(f"/api/v1/documents/{shared['id']}/shares", json={"email": "Bea@Example.com", "permission": "edit"})
    assert created.status_code == 201, created.text
    assert_schema(created.json(), "Share")
    assert created.json()["status"] == "pending"
    assert created.json()["email"] == "bea@example.com"
    duplicate = client.post(f"/api/v1/documents/{shared['id']}/shares", json={"email": "bea@example.com", "permission": "view"})
    assert duplicate.status_code == 409
    login(client, "bea@example.com")
    pending = client.get("/api/v1/invitations")
    assert pending.status_code == 200
    assert_schema(pending.json(), "InvitationList")
    invite = pending.json()["items"][0]
    assert invite["documentTitle"] == "Shared note"
    assert invite["ownerName"] == "Ada"
    assert invite["status"] == "pending"
    assert client.get(f"/api/v1/documents/{shared['id']}").status_code == 404
    assert SECRET not in pending.text
    assert SIBLING not in pending.text
    accepted = client.post(f"/api/v1/invitations/{invite['id']}/accept")
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["status"] == "accepted"
    visible = client.get(f"/api/v1/documents/{shared['id']}")
    assert visible.status_code == 200
    assert visible.json()["permission"] == "edit"
    assert visible.json()["meetingId"] is None
    assert visible.json()["text"] == SECRET
    assert visible.json()["original"] is not None
    file_url = visible.json()["original"]["url"]
    assert client.get(f"/api/v1/documents/{sibling['id']}").status_code == 404
    assert client.get(f"/api/v1/meetings/{meeting_id}").status_code == 404
    assert client.get("/api/v1/tasks").json()["total"] == 0
    assert client.get(f"/api/v1/documents/{shared['id']}/shares").status_code == 403
    reshare = client.post(f"/api/v1/documents/{shared['id']}/shares", json={"email": "cy@example.com", "permission": "view"})
    assert reshare.status_code == 403
    edited = client.patch(f"/api/v1/documents/{shared['id']}", json={"text": "Corrected packet routing secret is amber."})
    assert edited.status_code == 200, edited.text
    timeline = client.get("/api/v1/timeline")
    assert timeline.status_code == 200
    assert any(item["source"]["documentId"] == shared["id"] for item in timeline.json()["items"])
    assert all(item["meetingId"] is None for item in timeline.json()["items"])
    assert SIBLING not in timeline.text
    login(client, "cy@example.com")
    assert client.get("/api/v1/invitations").json()["items"] == []
    assert client.post(f"/api/v1/invitations/{invite['id']}/accept").status_code == 404
    assert client.get(f"/api/v1/documents/{shared['id']}").status_code == 404
    assert client.get(f"/api/v1/documents/{shared['id']}/shares").status_code == 404
    login(client, "admin@example.com")
    session = client.get("/api/v1/session")
    assert session.json()["user"]["role"] == "admin"
    assert client.get(f"/api/v1/documents/{shared['id']}").status_code == 404
    assert client.get(f"/api/v1/documents/{shared['id']}/shares").status_code == 404
    assert SECRET not in client.get("/api/v1/documents").text
    login(client, "ada@example.com")
    listed = client.get(f"/api/v1/documents/{shared['id']}/shares")
    assert listed.status_code == 200
    assert listed.json()["items"][0]["permission"] == "edit"
    downgraded = client.patch(
        f"/api/v1/documents/{shared['id']}/shares/{created.json()['id']}",
        json={"permission": "view"},
    )
    assert downgraded.status_code == 200
    assert downgraded.json()["permission"] == "view"
    login(client, "bea@example.com")
    assert client.patch(f"/api/v1/documents/{shared['id']}", json={"title": "Stolen"}).status_code == 403
    assert client.get(f"/api/v1/documents/{shared['id']}").status_code == 200
    login(client, "ada@example.com")
    revoked = client.delete(f"/api/v1/documents/{shared['id']}/shares/{created.json()['id']}")
    assert revoked.status_code == 204
    login(client, "bea@example.com")
    assert client.get(f"/api/v1/documents/{shared['id']}").status_code == 404
    assert client.get("/api/v1/documents?ownership=shared").json()["total"] == 0
    after = client.get("/api/v1/timeline")
    assert shared["id"] not in after.text
    assert SECRET not in after.text
    if file_url:
        assert client.get(file_url).status_code == 200
    assert client.post(f"/api/v1/invitations/{invite['id']}/accept").status_code == 409


def test_revocation_redacts_saved_answers_and_blocks_new_retrieval(client, app, caplog):
    app.state.embedder = FakeEmbedder()
    app.state.generator = FakeGenerator()
    register_and_verify(client, caplog, email="ada@example.com", name="Ada")
    register_and_verify(client, caplog, email="bea@example.com", name="Bea")
    login(client, "ada@example.com")
    job_id = ingest(client, SECRET, "answer-doc", "Answer note")
    assert finish(client, job_id)["status"] == "succeeded"
    document_id = client.get("/api/v1/documents").json()["items"][0]["id"]
    share = client.post(f"/api/v1/documents/{document_id}/shares", json={"email": "bea@example.com", "permission": "view"})
    assert share.status_code == 201, share.text
    login(client, "bea@example.com")
    invite = client.get("/api/v1/invitations").json()["items"][0]
    assert client.post(f"/api/v1/invitations/{invite['id']}/accept").status_code == 200
    asked = client.post(
        "/api/v1/assistant/query",
        data={"query": "How are packets routed?", "context": json.dumps({"conversationId": None, "documentIds": [document_id]})},
        headers={"Idempotency-Key": "bea-answer"},
    )
    assert asked.status_code == 202, asked.text
    finished = poll(client, asked.json()["id"])
    assert finished["status"] == "succeeded", finished
    assert "amber" in finished["answer"]["answer"]["text"]
    login(client, "ada@example.com")
    assert client.delete(f"/api/v1/documents/{document_id}/shares/{share.json()['id']}").status_code == 204
    login(client, "bea@example.com")
    history = client.get(f"/api/v1/conversations/{finished['conversationId']}")
    assert history.status_code == 200
    saved = history.json()["messages"][-1]
    assert saved["sources"] == []
    assert saved["insufficientEvidence"] is True
    assert "amber" not in saved["text"].lower()
    assert "no longer available" in saved["text"].lower()
    blocked = client.post(
        "/api/v1/assistant/query",
        data={"query": "How are packets routed?", "context": json.dumps({"conversationId": None, "documentIds": [document_id]})},
        headers={"Idempotency-Key": "bea-again"},
    )
    assert blocked.status_code == 404
    queued = client.post(
        "/api/v1/assistant/query",
        data={"query": "How are packets routed?", "context": json.dumps({"conversationId": None, "documentIds": []})},
        headers={"Idempotency-Key": "bea-empty"},
    )
    assert queued.status_code == 202, queued.text
    empty = poll(client, queued.json()["id"])
    assert "amber" not in json.dumps(empty).lower()


def test_expired_and_declined_invitations_stay_private(client, app, caplog):
    register_and_verify(client, caplog, email="ada@example.com", name="Ada")
    login(client, "ada@example.com")
    job_id = ingest(client, SECRET, "later", "Later note")
    assert finish(client, job_id)["status"] == "succeeded"
    document_id = client.get("/api/v1/documents").json()["items"][0]["id"]
    pending = client.post(f"/api/v1/documents/{document_id}/shares", json={"email": "new@example.com", "permission": "view"})
    assert pending.status_code == 201, pending.text
    register_and_verify(client, caplog, email="new@example.com", name="New")
    login(client, "new@example.com")
    invite = client.get("/api/v1/invitations").json()["items"][0]
    assert invite["status"] == "pending"
    assert client.get(f"/api/v1/documents/{document_id}").status_code == 404
    declined = client.post(f"/api/v1/invitations/{invite['id']}/decline")
    assert declined.status_code == 200
    assert declined.json()["status"] == "declined"
    assert client.get("/api/v1/invitations").json()["items"] == []
    assert client.get(f"/api/v1/documents/{document_id}").status_code == 404
    login(client, "ada@example.com")
    again = client.post(f"/api/v1/documents/{document_id}/shares", json={"email": "new@example.com", "permission": "view"})
    assert again.status_code == 201, again.text
    db = app.state.sessionmaker()
    try:
        grant = db.get(DocumentGrant, again.json()["id"])
        grant.expires_at = utcnow() - timedelta(minutes=1)
        db.commit()
    finally:
        db.close()
    login(client, "new@example.com")
    assert client.get("/api/v1/invitations").json()["items"] == []
    assert client.post(f"/api/v1/invitations/{again.json()['id']}/accept").status_code == 409
    assert client.get(f"/api/v1/documents/{document_id}").status_code == 404
    login(client, "ada@example.com")
    assert client.get(f"/api/v1/documents/{document_id}/shares").json()["items"] == []
    renewed = client.post(f"/api/v1/documents/{document_id}/shares", json={"email": "new@example.com", "permission": "edit"})
    assert renewed.status_code == 201
