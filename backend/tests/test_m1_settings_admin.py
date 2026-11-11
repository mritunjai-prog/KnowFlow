from app.models import Document, DocumentGrant, Job
from app.security import new_id, utcnow
from tests.helpers import assert_schema, bootstrap, register_and_verify, verification_token

PASSWORD = "correct-horse-1"


def login(client, email="ada@example.com", password=PASSWORD):
    bootstrap(client)
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    client.headers["X-CSRF-Token"] = response.json()["csrfToken"]
    return response.json()


def test_settings_onboarding_and_email_change(client, caplog):
    register_and_verify(client, caplog)
    user = login(client)
    assert user["user"]["onboardingComplete"] is False
    saved = client.patch(
        "/api/v1/settings",
        json={"name": "Ada", "email": "ada@example.com", "captureSource": "text", "modelId": None},
    )
    assert saved.status_code == 200, saved.text
    assert_schema(saved.json(), "Settings")
    assert saved.json()["captureSource"] == "text"
    with caplog.at_level("INFO", logger="knowflow.verification"):
        pending = client.patch(
            "/api/v1/settings",
            json={"name": "Augusta", "email": "new@example.com", "captureSource": "text", "modelId": None},
        )
    assert pending.status_code == 200, pending.text
    assert_schema(pending.json(), "Settings")
    assert pending.json()["email"] == "ada@example.com"
    assert pending.json()["name"] == "Augusta"
    assert "token=" not in pending.text
    assert client.get("/api/v1/settings").json()["email"] == "ada@example.com"
    token = verification_token(caplog, "email_change", "new@example.com")
    confirmed = client.post(
        "/api/v1/auth/email-verifications/confirm",
        json={"token": token, "password": PASSWORD},
    )
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["user"]["email"] == "new@example.com"
    client.headers["X-CSRF-Token"] = confirmed.json()["csrfToken"]
    done = client.patch("/api/v1/onboarding", json={"complete": True})
    assert done.status_code == 200
    assert_schema(done.json(), "Session")
    assert done.json()["user"]["onboardingComplete"] is True
    assert client.get("/api/v1/session").json()["user"]["onboardingComplete"] is True


def test_capabilities_advertise_local_capture_only(client):
    body = client.get("/api/v1/capabilities").json()
    assert_schema(body, "Capabilities")
    assert body["acceptedMimeTypes"] == [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
    ]
    assert body["captureSources"] == ["file", "text"]
    assert "audio" not in body["captureSources"]
    assert body["multimodal"] is False
    assert body["transcription"] is False
    assert body["models"]
    assert all(model["available"] is False for model in body["models"])
    assert "api_key" not in json_text(body)


def json_text(value) -> str:
    import json

    return json.dumps(value).lower()


def test_admin_is_private_and_has_no_user_content(client, app, caplog):
    register_and_verify(client, caplog, email="ada@example.com")
    login(client)
    denied = client.get("/api/v1/admin/status")
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "FORBIDDEN"
    anonymous = client.get("/api/v1/admin/config")
    client.cookies.clear()
    anonymous = client.get("/api/v1/admin/config")
    assert anonymous.status_code == 401

    register_and_verify(client, caplog, email="admin@example.com", name="Owner")
    login(client, email="admin@example.com")
    status = client.get("/api/v1/admin/status")
    assert status.status_code == 200, status.text
    assert_schema(status.json(), "AdminStatus")
    text = json_text(status.json())
    assert "ada@example.com" not in text
    assert "password" not in text
    assert "postgres" not in text
    config = client.get("/api/v1/admin/config")
    assert_schema(config.json(), "AdminConfig")
    updated = client.patch(
        "/api/v1/admin/config",
        json={"storageLimitBytes": 1024, "defaultModelId": None, "captureSources": ["file", "text"]},
    )
    assert updated.status_code == 200
    assert updated.json()["storageLimitBytes"] == 1024
    secret = client.patch(
        "/api/v1/admin/config",
        json={"storageLimitBytes": 1024, "defaultModelId": "gemini-flash", "captureSources": ["file"]},
    )
    assert secret.status_code == 422
    db = app.state.sessionmaker()
    owner = db.query(__import__("app.models", fromlist=["User"]).User).filter_by(email="ada@example.com").one()
    db.add(Document(id=new_id(), owner_id=owner.id, title="Private note", storage_bytes=12, created_at=utcnow()))
    db.add(Job(id=new_id(), owner_id=owner.id, status="queued", created_at=utcnow()))
    db.add(Job(id=new_id(), owner_id=owner.id, status="failed", created_at=utcnow()))
    db.commit()
    db.close()
    status = client.get("/api/v1/admin/status")
    assert status.json()["documentCount"] == 1
    assert status.json()["queuedJobs"] == 1
    assert status.json()["failedJobs"] == 1
    assert status.json()["storageUsedBytes"] == 12
    assert "Private note" not in json_text(status.json())


def test_acl_primitives_do_not_treat_admin_as_document_owner(app, client, caplog):
    from app.acl import can_edit, can_manage_grants, can_read
    from app.models import User

    register_and_verify(client, caplog, email="ada@example.com")
    register_and_verify(client, caplog, email="admin@example.com", name="Owner")
    register_and_verify(client, caplog, email="viewer@example.com", name="View")
    db = app.state.sessionmaker()
    owner = db.query(User).filter_by(email="ada@example.com").one()
    admin = db.query(User).filter_by(email="admin@example.com").one()
    viewer = db.query(User).filter_by(email="viewer@example.com").one()
    document = Document(id=new_id(), owner_id=owner.id, title="Notes", storage_bytes=0, created_at=utcnow())
    db.add(document)
    db.flush()
    db.add(
        DocumentGrant(
            id=new_id(),
            document_id=document.id,
            grantee_user_id=viewer.id,
            grantee_email=viewer.email,
            permission="view",
            status="accepted",
            created_at=utcnow(),
        )
    )
    db.commit()
    assert can_read(db, owner, document) and can_manage_grants(db, owner, document)
    assert can_read(db, viewer, document) and not can_edit(db, viewer, document)
    assert not can_read(db, admin, document)
    db.close()
