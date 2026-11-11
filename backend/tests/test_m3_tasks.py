import json
from datetime import timedelta

from tests.helpers import assert_schema, bootstrap, register_and_verify
from tests.test_m2_capture import META, finish, ingest, login

PASSWORD = "correct-horse-1"


def _open(client, caplog, email="ada@example.com"):
    register_and_verify(client, caplog, email=email, name="Ada Lovelace" if email.startswith("ada") else "Other")
    login(client, email=email)


def _meta(**overrides):
    body = {
        **META,
        "title": "Untitled page",
        "tags": [],
        "documentType": None,
        "meetingId": None,
        "meetingTitle": None,
        "occurredAt": None,
    }
    body.update(overrides)
    return body


def test_held_out_metrics_are_measured_not_hardcoded():
    import numpy as np

    from app.ml import HELD_ACTIONS, HELD_DOCUMENTS, TRAIN_ACTIONS, TRAIN_DOCUMENTS, evaluate_held_out, get_model

    report = evaluate_held_out()
    assert report["overlap"] == 0
    assert {row["id"] for row in TRAIN_DOCUMENTS}.isdisjoint({row["id"] for row in HELD_DOCUMENTS})
    assert {row["id"] for row in TRAIN_ACTIONS}.isdisjoint({row["id"] for row in HELD_ACTIONS})
    assert report["heldDocuments"] >= 10
    assert report["heldActions"] >= 12
    assert 0 <= report["documentType"]["macroF1"] <= 1
    assert 0 <= report["topics"]["precision"] <= 1
    assert 0 <= report["actions"]["recall"] <= 1
    assert report["documentType"]["macroF1"] >= 0.8
    assert report["topics"]["f1"] >= 0.5
    assert report["actions"]["precision"] == report["actions"]["tp"] / (report["actions"]["tp"] + report["actions"]["fp"])
    assert report["actions"]["f1"] >= 0.8
    model = get_model()
    assert np.any(model.type_weights)
    blank = model.classify("nothing particular is written here")
    signal = model.classify(HELD_DOCUMENTS[0]["text"])
    assert blank["typeScores"] != signal["typeScores"]
    print("M3_EVAL", json.dumps({
        "modelId": report["modelId"],
        "documentAccuracy": report["documentType"]["accuracy"],
        "documentMacroF1": report["documentType"]["macroF1"],
        "topicPrecision": report["topics"]["precision"],
        "topicRecall": report["topics"]["recall"],
        "topicF1": report["topics"]["f1"],
        "clusterF1": report["clusters"]["f1"],
        "actionPrecision": report["actions"]["precision"],
        "actionRecall": report["actions"]["recall"],
        "actionF1": report["actions"]["f1"],
        "topicMisses": report["topics"]["fn"],
    }))


def test_classifier_request_has_no_tools():
    from app.classify import action_request, classification_request, parse_due_date
    from app.transcribe import PINNED_MODEL

    body = classification_request("Synthetic academic note.", "Untitled page")
    actions = action_request("Please submit the lab report by 2026-12-01.")
    assert PINNED_MODEL == "gemini-3.8-flash"
    for payload in (body, actions):
        assert "tools" not in payload
        assert "google_search" not in json.dumps(payload)
        assert payload["generationConfig"]["temperature"] == 0
    assert body["generationConfig"]["responseMimeType"] == "application/json"
    assert parse_due_date("Please submit the lab report by 2026-12-01.") == "2026-12-01"
    assert parse_due_date("due November 20, 2026") == "2026-11-20"
    assert parse_due_date("due 20 November 2026") == "2026-11-20"
    assert parse_due_date("due 2026-02-31") is None


def test_model_labels_and_tasks_follow_durable_steps(client, app, caplog):
    from app.ml import HELD_DOCUMENTS
    from app.models import Document, JobItem

    _open(client, caplog)
    row = next(item for item in HELD_DOCUMENTS if item["id"] == "held-doc-assignment-algorithms")
    created = ingest(client, text=row["text"], metadata=_meta(), key="class-1")
    assert created.status_code == 202, created.text
    job_id = created.json()["id"]
    first = client.get(f"/api/v1/jobs/{job_id}")
    assert first.json()["status"] == "running"
    assert first.json()["items"][0]["documentId"] is None
    db = app.state.sessionmaker()
    item = db.scalar(__import__("sqlalchemy").select(JobItem).where(JobItem.job_id == job_id))
    assert item.step == "classify"
    assert item.classification_json is None
    db.close()
    second = client.get(f"/api/v1/jobs/{job_id}")
    assert second.json()["items"][0]["documentId"] is None
    db = app.state.sessionmaker()
    item = db.scalar(__import__("sqlalchemy").select(JobItem).where(JobItem.job_id == job_id))
    assert item.step == "actions"
    assert "assignment" in item.classification_json
    db.close()
    third = client.get(f"/api/v1/jobs/{job_id}")
    assert third.json()["items"][0]["documentId"] is None
    done = finish(client, job_id)
    assert done["status"] == "succeeded"
    document = client.get(f"/api/v1/documents/{done['items'][0]['documentId']}")
    assert document.status_code == 200, document.text
    body = document.json()
    assert_schema(body, "DocumentRecord")
    assert body["documentType"] == "assignment"
    assert "algorithms" in body["tags"]
    stored = app.state.sessionmaker()
    record = stored.get(Document, body["id"])
    assert record.labels_origin == "model"
    assert record.classifier_id == "local-tfidf-logistic-v1"
    assert record.index_state == "pending"
    assert record.index_version == 0
    stored.close()


def test_actions_are_idempotent_and_survive_restart(database_url, caplog):
    import logging

    from fastapi.testclient import TestClient

    from app.config import get_settings
    from app.main import create_app
    from app.models import Job, JobItem, TaskRecord

    get_settings.cache_clear()
    first = create_app()
    logging.getLogger("knowflow.verification").addHandler(caplog.handler)
    with TestClient(first) as client:
        client.headers["Origin"] = "http://test.example"
        _open(client, caplog)
        metadata = _meta(meetingTitle="Study group", occurredAt="2026-11-10T15:00:00+00:00")
        created = ingest(
            client,
            text="Please submit the lab report by 2026-12-01.",
            metadata=metadata,
            key="action-1",
        )
        assert created.status_code == 202, created.text
        job_id = created.json()["id"]
    first.state.engine.dispose()

    get_settings.cache_clear()
    restarted = create_app()
    with TestClient(restarted) as client:
        client.headers["Origin"] = "http://test.example"
        login(client)
        done = finish(client, job_id, limit=8)
        assert done["status"] == "succeeded", done
        listed = client.get("/api/v1/tasks")
        assert listed.status_code == 200, listed.text
        assert_schema(listed.json(), "PageTask")
        assert listed.json()["total"] == 1
        task = listed.json()["items"][0]
        assert_schema(task, "Task")
        assert task["dueDate"] == "2026-12-01"
        assert task["meetingId"] == done["meetingId"]
        assert task["source"]["documentId"] == done["items"][0]["documentId"]
        assert task["status"] == "pending"
        edited = client.patch(
            f"/api/v1/tasks/{task['id']}",
            json={"description": "Submit the corrected lab report", "status": "completed", "priority": "low"},
        )
        assert edited.status_code == 200, edited.text
        assert edited.json()["description"] == "Submit the corrected lab report"
        assert edited.json()["dueDate"] == "2026-12-01"
        assert edited.json()["status"] == "completed"
        db = restarted.state.sessionmaker()
        job = db.get(Job, job_id)
        item = db.scalar(__import__("sqlalchemy").select(JobItem).where(JobItem.job_id == job_id))
        job.status = "failed"
        job.retryable = True
        item.status = "failed"
        item.step = "done"
        db.commit()
        db.close()
        retried = client.post(f"/api/v1/jobs/{job_id}/retry")
        assert retried.status_code == 202, retried.text
        finish(client, job_id, limit=8)
        again = client.get("/api/v1/tasks")
        assert again.json()["total"] == 1
        assert again.json()["items"][0]["id"] == task["id"]
        assert again.json()["items"][0]["description"] == "Submit the corrected lab report"
        assert again.json()["items"][0]["status"] == "completed"
        assert again.json()["items"][0]["priority"] == "low"
        removed = client.delete(f"/api/v1/tasks/{task['id']}")
        assert removed.status_code == 204
        assert removed.content == b""
        assert client.get(f"/api/v1/documents/{done['items'][0]['documentId']}").status_code == 200
        db = restarted.state.sessionmaker()
        job = db.get(Job, job_id)
        item = db.scalar(__import__("sqlalchemy").select(JobItem).where(JobItem.job_id == job_id))
        job.status = "failed"
        job.retryable = True
        item.status = "failed"
        db.commit()
        db.close()
        assert client.post(f"/api/v1/jobs/{job_id}/retry").status_code == 202
        finish(client, job_id, limit=8)
        assert client.get("/api/v1/tasks").json()["total"] == 0
        db = restarted.state.sessionmaker()
        assert db.query(TaskRecord).count() == 0
        db.close()
    restarted.state.engine.dispose()
    logging.getLogger("knowflow.verification").removeHandler(caplog.handler)


def test_task_api_filters_ownership_and_revoked_source(client, app, caplog):
    from app.models import DocumentGrant
    from app.security import new_id, utcnow

    _open(client, caplog)
    created = ingest(
        client,
        text="Please send the corrected bibliography to the partner.",
        metadata=_meta(meetingTitle="Study group", occurredAt="2026-11-10T15:00:00+00:00"),
        key="api-1",
    )
    done = finish(client, created.json()["id"])
    document_id = done["items"][0]["documentId"]
    owner_tasks = client.get("/api/v1/tasks").json()
    assert owner_tasks["total"] >= 1
    assert owner_tasks["items"][0]["meetingId"] == done["meetingId"]
    made = client.post(
        "/api/v1/tasks",
        json={"description": "Read the source again", "priority": "medium", "dueDate": "2026-11-21", "sourceDocumentId": document_id},
    )
    assert made.status_code == 201, made.text
    assert_schema(made.json(), "Task")
    assert made.json()["status"] == "pending"
    assert made.json()["dueDate"] == "2026-11-21"
    reopened = client.patch(f"/api/v1/tasks/{made.json()['id']}", json={"status": "completed"})
    assert reopened.json()["status"] == "completed"
    assert reopened.json()["dueDate"] == "2026-11-21"
    pending = client.patch(f"/api/v1/tasks/{made.json()['id']}", json={"status": "pending"})
    assert pending.json()["status"] == "pending"
    assert client.get("/api/v1/tasks", params={"status": "pending", "sourceId": document_id, "q": "source"}).json()["total"] == 1
    assert client.get("/api/v1/tasks", params={"status": "completed"}).json()["total"] == 0
    assert client.post("/api/v1/tasks", json={"description": "x", "priority": "medium", "dueDate": "2026-02-31", "sourceDocumentId": document_id}).status_code == 422
    assert client.get("/api/v1/tasks", params={"status": "later"}).status_code == 422
    client.cookies.clear()
    _open(client, caplog, email="other@example.com")
    assert client.get("/api/v1/tasks").json()["total"] == 0
    assert client.get(f"/api/v1/documents/{document_id}").status_code == 404
    assert client.patch(f"/api/v1/tasks/{made.json()['id']}", json={"status": "completed"}).status_code == 404
    db = app.state.sessionmaker()
    from app.models import User

    other = db.query(User).filter(User.email == "other@example.com").one()
    db.add(
        DocumentGrant(
            id=new_id(),
            document_id=document_id,
            grantee_user_id=other.id,
            grantee_email=other.email,
            permission="view",
            status="accepted",
            created_at=utcnow(),
        )
    )
    db.commit()
    db.close()
    shared = client.post(
        "/api/v1/tasks",
        json={"description": "Personal follow-up", "priority": "high", "dueDate": None, "sourceDocumentId": document_id},
    )
    assert shared.status_code == 201, shared.text
    assert shared.json()["meetingId"] is None
    visible = client.get("/api/v1/tasks").json()
    assert visible["total"] == 1
    assert visible["items"][0]["description"] == "Personal follow-up"
    assert "bibliography" not in json.dumps(visible)
    db = app.state.sessionmaker()
    grant = db.query(DocumentGrant).one()
    grant.status = "revoked"
    db.commit()
    db.close()
    hidden = client.get("/api/v1/tasks")
    assert hidden.json()["total"] == 0
    assert shared.json()["id"] not in hidden.text
    assert client.get(f"/api/v1/documents/{document_id}").status_code == 404
    assert client.patch(f"/api/v1/tasks/{shared.json()['id']}", json={"status": "completed"}).status_code == 404


def test_correction_invalidates_retrieval_without_retraining(client, app, caplog):
    from app.models import Document

    calls = {"classify": 0}

    class Counting:
        def classify(self, text, title=""):
            calls["classify"] += 1
            return {"modelId": "fake-classifier", "documentType": "bill", "topics": ["accounting"], "clusterTopics": [], "typeScores": {}}

        def detect_actions(self, text, page=1):
            return []

    app.state.classifier = Counting()
    _open(client, caplog)
    created = ingest(client, text="A short synthetic note with no obligation.", metadata=_meta(), key="correct-1")
    done = finish(client, created.json()["id"])
    document_id = done["items"][0]["documentId"]
    assert calls["classify"] == 1
    before = app.state.sessionmaker()
    original = before.get(Document, document_id)
    original_model = original.classifier_id
    original_json = original.classification_json
    before.close()
    changed = client.patch(
        f"/api/v1/documents/{document_id}",
        json={"title": "Corrected title", "documentType": "lecture note", "tags": ["networks"], "text": "Corrected text"},
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["documentType"] == "lecture note"
    assert changed.json()["tags"] == ["networks"]
    assert changed.json()["text"] == "Corrected text"
    assert calls["classify"] == 1
    after = app.state.sessionmaker()
    record = after.get(Document, document_id)
    assert record.index_state == "stale"
    assert record.index_version == 1
    assert record.retrieval_invalidated_at is not None
    assert record.labels_origin == "corrected"
    assert record.classifier_id == original_model
    assert record.classification_json == original_json
    after.close()
    timeline = client.get("/api/v1/timeline", params={"timezone": "UTC"})
    assert timeline.json()["items"][0]["title"] == "Corrected title"
    assert timeline.json()["items"][0]["type"] == "lecture note"
    assert "Corrected text" in timeline.json()["items"][0]["source"]["excerpt"]


def test_fake_adapter_is_isolated_from_the_provider(client, app, caplog):
    from app.classify import fingerprint

    class Fake:
        def __init__(self):
            self.calls = []

        def classify(self, text, title=""):
            self.calls.append("classify")
            return {"modelId": "fake-classifier", "documentType": "bill", "topics": ["accounting"], "clusterTopics": ["accounting"], "typeScores": {}}

        def detect_actions(self, text, page=1):
            self.calls.append("actions")
            excerpt = "Please pay the invoice before 2026-11-18."
            return [{
                "description": excerpt,
                "priority": "high",
                "dueDate": "2026-11-18",
                "excerpt": excerpt,
                "page": page,
                "fingerprint": fingerprint(page, excerpt),
            }]

    fake = Fake()
    app.state.classifier = fake
    _open(client, caplog)
    created = ingest(client, text="Please pay the invoice before 2026-11-18.", metadata=_meta(), key="fake-1")
    job_id = created.json()["id"]
    client.get(f"/api/v1/jobs/{job_id}")
    assert fake.calls == []
    client.get(f"/api/v1/jobs/{job_id}")
    assert fake.calls == ["classify"]
    client.get(f"/api/v1/jobs/{job_id}")
    assert fake.calls == ["classify", "actions"]
    done = finish(client, job_id)
    document = client.get(f"/api/v1/documents/{done['items'][0]['documentId']}").json()
    assert document["documentType"] == "bill"
    assert document["tags"] == ["accounting"]
    task = client.get("/api/v1/tasks").json()["items"][0]
    assert task["dueDate"] == "2026-11-18"
    assert task["priority"] == "high"
    assert task["source"]["documentId"] == document["id"]
    assert "generativelanguage.googleapis.com" not in json.dumps(fake.calls)
