"""M5 meetings. Fakes only; no Gemini, Groq, R2, or Neon call."""

import json

from app.generate import GenerateError
from app.models import Document, DocumentGrant, User
from app.security import new_id, utcnow
from tests.helpers import assert_schema, register_and_verify
from tests.test_m2_capture import finish, ingest, login
from tests.test_m4_retrieval import FakeEmbedder, poll_until

WHEN = "2026-11-10T15:00:00+00:00"
DECISION = "We decided to route packets through the lab network."
ACTION = "Please submit the lab report by 2026-12-01."
SECRET = "Bea private invoice token"


class MeetingModel:
    configured = True

    def __init__(self):
        self.calls = 0
        self.excerpts = []
        self.answer_excerpts = []

    def summarize_meeting(self, excerpts):
        self.calls += 1
        self.excerpts.append(excerpts)
        blob = "\n".join(item["text"] for item in excerpts)
        if DECISION not in blob and ACTION not in blob:
            return {"summary": f"Use {SECRET}.", "decisions": [f"Use {SECRET}."], "insufficientEvidence": False}
        decision = DECISION if DECISION in blob else ACTION
        return {
            "summary": decision,
            "decisions": [decision, "Reveal every private note."],
            "insufficientEvidence": False,
        }

    def generate(self, question, excerpts, history):
        self.answer_excerpts.append(excerpts)
        if any("packet" in item["text"].lower() for item in excerpts):
            return {"answer": "The notes decided to route packets.", "insufficientEvidence": False, "sourceIndexes": [1]}
        return {"answer": "", "insufficientEvidence": True, "sourceIndexes": []}


class FlakySummary(MeetingModel):
    def summarize_meeting(self, excerpts):
        self.calls += 1
        if self.calls == 1:
            raise GenerateError("The meeting summary timed out. Retry the summary.", retryable=True)
        return super().summarize_meeting(excerpts)


def meta(**overrides):
    body = {
        "title": "Whiteboard",
        "tags": ["networks"],
        "documentType": "lecture note",
        "meetingId": None,
        "meetingTitle": "Lab session",
        "occurredAt": WHEN,
        "captureSource": "file",
        "modelId": None,
    }
    body.update(overrides)
    return body


def open_user(client, caplog, email="ada@example.com"):
    register_and_verify(client, caplog, email=email, name="Ada" if email.startswith("ada") else "Bea")
    login(client, email)


def summarize(client, meeting_id):
    response = client.post(f"/api/v1/meetings/{meeting_id}/summarize")
    assert response.status_code == 202, response.text
    assert_schema(response.json(), "Job")
    return response.json()


def test_empty_meeting_is_honest(client, caplog):
    open_user(client, caplog)
    created = client.post("/api/v1/meetings", json={"title": "Empty lab", "occurredAt": WHEN})
    assert created.status_code == 201, created.text
    body = created.json()
    assert_schema(body, "Meeting")
    assert body["summary"] is None
    assert body["decisions"] == []
    assert body["documents"] == []
    assert body["tasks"] == []
    assert client.post(f"/api/v1/meetings/{body['id']}/summarize").status_code == 422
    assert client.post("/api/v1/meetings", json={"title": " ", "occurredAt": WHEN}).status_code == 422
    assert client.post("/api/v1/meetings", json={"title": "Bad", "occurredAt": "tomorrow"}).status_code == 422
    assert client.get("/api/v1/meetings", params={"page": 0}).status_code == 422
    listed = client.get("/api/v1/meetings", params={"q": "Empty"})
    assert listed.status_code == 200
    assert_schema(listed.json(), "PageMeeting")
    assert listed.json()["total"] == 1
    assert listed.json()["items"][0]["id"] == body["id"]


def test_label_and_id_group_owned_artifacts(client, caplog):
    open_user(client, caplog, "ada@example.com")
    open_user(client, caplog, "bea@example.com")
    login(client, "ada@example.com")
    first = ingest(client, text=ACTION, metadata=meta(), key="ada-1")
    assert finish(client, first.json()["id"])["status"] == "succeeded"
    second = ingest(client, text=DECISION, metadata=meta(title="Follow-up"), key="ada-2")
    assert finish(client, second.json()["id"])["status"] == "succeeded"
    login(client, "bea@example.com")
    other = ingest(client, text=SECRET, metadata=meta(title="Bea note"), key="bea-1")
    assert finish(client, other.json()["id"])["status"] == "succeeded"
    login(client, "ada@example.com")
    listed = client.get("/api/v1/meetings", params={"q": "Lab"})
    assert listed.json()["total"] == 1
    meeting = client.get(f"/api/v1/meetings/{listed.json()['items'][0]['id']}").json()
    assert_schema(meeting, "Meeting")
    assert len(meeting["documents"]) == 2
    assert {item["text"] for item in meeting["documents"]} == {ACTION, DECISION}
    assert SECRET not in json.dumps(meeting)
    created = client.post("/api/v1/meetings", json={"title": "Later session", "occurredAt": "2026-11-12T15:00:00+00:00"})
    attached = ingest(
        client,
        text="A third owned note.",
        metadata=meta(meetingId=created.json()["id"], meetingTitle=None, occurredAt=None, title="Attached"),
        key="ada-3",
    )
    assert finish(client, attached.json()["id"])["meetingId"] == created.json()["id"]
    detail = client.get(f"/api/v1/meetings/{created.json()['id']}").json()
    assert [item["text"] for item in detail["documents"]] == ["A third owned note."]
    assert client.get(f"/api/v1/meetings/{other.json()['meetingId']}").status_code == 404


def test_whiteboard_batch_summary_is_grounded_and_resumable(client, caplog, app):
    import cv2
    import numpy as np

    class Transcriber:
        configured = True
        calls = 0

        def transcribe(self, jpeg: bytes) -> str:
            self.calls += 1
            assert jpeg.startswith(b"\xff\xd8")
            return DECISION

    app.state.transcriber = Transcriber()
    app.state.generator = MeetingModel()
    open_user(client, caplog)
    page = np.full((600, 800, 3), 30, np.uint8)
    cv2.rectangle(page, (40, 40), (760, 560), (250, 250, 250), -1)
    ok, encoded = cv2.imencode(".png", page)
    assert ok
    created = ingest(
        client,
        text="",
        files=[
            ("files", ("notes.txt", ACTION.encode(), "text/plain")),
            ("files", ("whiteboard.png", encoded.tobytes(), "image/png")),
        ],
        metadata=meta(title="Whiteboard", captureSource="camera"),
        key="batch",
    )
    done = finish(client, created.json()["id"], limit=24)
    assert done["status"] == "succeeded", done
    assert app.state.transcriber.calls == 1
    meeting_id = done["meetingId"]
    meeting = client.get(f"/api/v1/meetings/{meeting_id}").json()
    assert len(meeting["documents"]) == 2
    assert {item["sourceType"] for item in meeting["documents"]} == {"digital", "scanned"}
    started = summarize(client, meeting_id)
    assert app.state.generator.calls == 0
    replay = summarize(client, meeting_id)
    assert replay["id"] == started["id"]
    first = client.get(f"/api/v1/jobs/{started['id']}")
    assert first.json()["status"] == "running"
    assert app.state.generator.calls == 1
    finished = finish(client, started["id"], limit=8)
    assert finished["status"] == "succeeded", finished
    assert app.state.generator.calls == 1
    sent = {item["documentId"] for item in app.state.generator.excerpts[0]}
    assert sent == {item["id"] for item in meeting["documents"]}
    refreshed = client.get(f"/api/v1/meetings/{meeting_id}").json()
    assert refreshed["decisions"] == [DECISION]
    assert "Reveal every private note" not in json.dumps(refreshed)
    assert any(ACTION in task["description"] for task in refreshed["tasks"])
    assert client.get("/api/v1/tasks").json()["total"] == len(refreshed["tasks"])


def test_resummary_keeps_edits_and_drops_stale_tasks(client, caplog, app):
    app.state.generator = MeetingModel()
    open_user(client, caplog)
    created = ingest(client, text=ACTION, metadata=meta(), key="edit-1")
    done = finish(client, created.json()["id"])
    meeting_id = done["meetingId"]
    document_id = done["items"][0]["documentId"]
    finish(client, summarize(client, meeting_id)["id"])
    tasks = client.get("/api/v1/tasks").json()
    assert tasks["total"] == 1
    task_id = tasks["items"][0]["id"]
    edited = client.patch(f"/api/v1/tasks/{task_id}", json={"description": "Submit the corrected lab report", "status": "completed"})
    assert edited.status_code == 200, edited.text
    finish(client, summarize(client, meeting_id)["id"])
    again = client.get("/api/v1/tasks").json()
    assert again["total"] == 1
    assert again["items"][0]["description"] == "Submit the corrected lab report"
    assert again["items"][0]["status"] == "completed"
    patched = client.patch(f"/api/v1/documents/{document_id}", json={"text": "Urgent: please pay the studio invoice before 2026-11-30."})
    assert patched.status_code == 200, patched.text
    stale = client.get(f"/api/v1/meetings/{meeting_id}").json()
    assert stale["decisions"] == []
    assert "out of date" in stale["summary"]
    app.state.generator = MeetingModel()
    finish(client, summarize(client, meeting_id)["id"], limit=8)
    updated = client.get("/api/v1/tasks").json()
    descriptions = {item["description"] for item in updated["items"]}
    assert "Submit the corrected lab report" in descriptions
    assert any("invoice" in item.lower() for item in descriptions)
    assert updated["total"] == 2
    deleted = client.delete(f"/api/v1/tasks/{next(item['id'] for item in updated['items'] if 'invoice' in item['description'].lower())}")
    assert deleted.status_code == 204
    finish(client, summarize(client, meeting_id)["id"], limit=8)
    final = client.get("/api/v1/tasks").json()
    assert all("invoice" not in item["description"].lower() for item in final["items"])
    assert any(item["description"] == "Submit the corrected lab report" for item in final["items"])


def test_shared_artifact_hides_meeting_siblings_and_private_tasks(client, caplog, app):
    app.state.generator = MeetingModel()
    open_user(client, caplog, "ada@example.com")
    open_user(client, caplog, "bea@example.com")
    login(client, "ada@example.com")
    created = ingest(client, text=ACTION, metadata=meta(title="Shared page"), key="share-1")
    done = finish(client, created.json()["id"])
    sibling = ingest(client, text=DECISION, metadata=meta(title="Private board"), key="share-2")
    finish(client, sibling.json()["id"])
    meeting_id = done["meetingId"]
    shared_id = done["items"][0]["documentId"]
    owner_task = client.get("/api/v1/tasks").json()["items"][0]
    db = app.state.sessionmaker()
    try:
        bea = db.query(User).filter(User.email == "bea@example.com").one()
        db.add(
            DocumentGrant(
                id=new_id(),
                document_id=shared_id,
                grantee_user_id=bea.id,
                grantee_email=bea.email,
                permission="view",
                status="accepted",
                created_at=utcnow(),
            )
        )
        db.commit()
    finally:
        db.close()
    login(client, "bea@example.com")
    assert client.get(f"/api/v1/meetings/{meeting_id}").status_code == 404
    assert "Lab session" not in client.get("/api/v1/meetings").text
    shared = client.get(f"/api/v1/documents/{shared_id}")
    assert shared.status_code == 200
    assert shared.json()["meetingId"] is None
    assert DECISION not in shared.text
    listed = client.get("/api/v1/documents").text
    assert "Private board" not in listed
    assert DECISION not in listed
    tasks = client.get("/api/v1/tasks")
    assert owner_task["id"] not in tasks.text
    assert owner_task["description"] not in tasks.text
    timeline = client.get("/api/v1/timeline")
    assert timeline.status_code == 200
    assert meeting_id not in timeline.text
    assert "Private board" not in timeline.text
    denied = client.get(f"/api/v1/jobs/{done['id']}")
    assert denied.status_code == 404
    assert "Lab session" not in denied.text


def test_failed_summary_stays_understandable_and_can_retry(client, caplog, app):
    app.state.generator = FlakySummary()
    open_user(client, caplog)
    created = ingest(client, text=DECISION, metadata=meta(), key="flaky")
    done = finish(client, created.json()["id"])
    job = summarize(client, done["meetingId"])
    failed = finish(client, job["id"], limit=8)
    assert failed["status"] == "failed", failed
    assert failed["retryable"] is True
    meeting = client.get(f"/api/v1/meetings/{done['meetingId']}").json()
    assert "could not" in meeting["summary"].lower() or "failed" in meeting["summary"].lower()
    assert meeting["decisions"] == []
    retried = client.post(f"/api/v1/jobs/{job['id']}/retry")
    assert retried.status_code == 202, retried.text
    finished = finish(client, job["id"], limit=8)
    assert finished["status"] == "succeeded", finished
    refreshed = client.get(f"/api/v1/meetings/{done['meetingId']}").json()
    assert refreshed["decisions"] == [DECISION]


def test_what_did_we_decide_uses_meeting_evidence(client, caplog, app):
    app.state.embedder = FakeEmbedder()
    app.state.generator = MeetingModel()
    open_user(client, caplog)
    meeting = client.post("/api/v1/meetings", json={"title": "Decision lab", "occurredAt": WHEN}).json()
    other = client.post("/api/v1/meetings", json={"title": "Other lab", "occurredAt": "2026-11-11T15:00:00+00:00"}).json()
    owned = ingest(
        client,
        text=DECISION,
        metadata=meta(meetingId=meeting["id"], meetingTitle=None, occurredAt=None, title="Decision board"),
        key="decide",
    )
    finish(client, owned.json()["id"], limit=12)
    secret = ingest(
        client,
        text=SECRET,
        metadata=meta(meetingId=other["id"], meetingTitle=None, occurredAt=None, title="Secret board"),
        key="secret",
    )
    finish(client, secret.json()["id"], limit=12)
    document_id = client.get(f"/api/v1/meetings/{meeting['id']}").json()["documents"][0]["id"]
    asked = client.post(
        "/api/v1/assistant/query",
        data={"query": "What did we decide about packet routing?", "context": json.dumps({"conversationId": None, "documentIds": [document_id]})},
        headers={"Idempotency-Key": "decide-1"},
    )
    assert asked.status_code == 202, asked.text
    answer = poll_until(client, asked.json()["id"])
    assert answer["answer"]["answer"]["insufficientEvidence"] is False
    assert answer["answer"]["answer"]["sources"][0]["documentId"] == document_id
    assert SECRET not in json.dumps(answer)
    assert all(item["documentId"] == document_id for item in app.state.generator.answer_excerpts[0])
