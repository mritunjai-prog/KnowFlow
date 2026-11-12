import json

import pytest

from tests.helpers import assert_schema, bootstrap, register_and_verify, verification_token

PASSWORD = "correct-horse-1"


def test_session_bootstraps_anonymous_csrf_and_rotates_it(client):
    first = client.get("/api/v1/session")
    second = client.get("/api/v1/session")
    assert first.status_code == second.status_code == 200
    assert_schema(first.json(), "Session")
    assert first.json()["user"] is None
    assert first.json()["csrfToken"] != second.json()["csrfToken"]
    cookie = first.headers["set-cookie"]
    assert "knowflow_session=" in cookie
    assert "HttpOnly" in cookie
    assert "Path=/" in cookie
    assert "SameSite=lax" in cookie
    assert "Domain=" not in cookie
    stale = client.post(
        "/api/v1/auth/login",
        headers={"X-CSRF-Token": first.json()["csrfToken"]},
        json={"email": "ada@example.com", "password": PASSWORD},
    )
    assert stale.status_code == 403
    assert stale.json()["error"]["code"] == "CSRF_FAILED"


def test_secure_host_only_cookie_flag(tmp_path, monkeypatch):
    from alembic import command
    from alembic.config import Config
    from fastapi.testclient import TestClient
    from pathlib import Path
    from app.config import get_settings
    from app.main import create_app

    url = f"sqlite:///{tmp_path / 'secure.db'}"
    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.setenv("KNOWFLOW_COOKIE_SECURE", "true")
    monkeypatch.setenv("KNOWFLOW_ALLOWED_ORIGINS", "http://test.example")
    monkeypatch.setenv("KNOWFLOW_ALEMBIC_URL", url)
    get_settings.cache_clear()
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    config.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "alembic"))
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "head")
    app = create_app()
    with TestClient(app) as secure_client:
        response = secure_client.get("/api/v1/session")
    cookie = response.headers["set-cookie"]
    assert "Secure" in cookie
    assert "HttpOnly" in cookie
    assert "Domain=" not in cookie
    app.state.engine.dispose()


def test_register_does_not_grant_session_and_hides_duplicates(client, caplog):
    register_and_verify(client, caplog)
    bootstrap(client)
    before = len(caplog.messages)
    duplicate = client.post(
        "/api/v1/auth/register",
        json={"name": "Other", "email": "ada@example.com", "password": "another-password-2"},
    )
    assert duplicate.status_code == 201
    assert_schema(duplicate.json(), "Session")
    assert duplicate.json()["user"] is None
    assert "token=" not in duplicate.text
    assert not any("purpose=registration email=ada@example.com token=" in message for message in caplog.messages[before:])


def test_login_logout_password_and_other_session_revocation(client, app, caplog):
    from fastapi.testclient import TestClient

    from app.models import AuthSession, User
    from app.security import digest, new_id, new_secret, utcnow
    from app.identity import absolute_deadline, idle_deadline

    register_and_verify(client, caplog, email="ada@example.com")
    bootstrap(client)
    wrong = client.post("/api/v1/auth/login", json={"email": "ada@example.com", "password": "nope-nope-nope"})
    assert wrong.status_code == 401
    assert wrong.json()["error"]["code"] == "INVALID_CREDENTIALS"
    missing = client.post("/api/v1/auth/login", json={"email": "missing@example.com", "password": PASSWORD})
    assert missing.status_code == 401
    assert missing.json()["error"]["message"] == wrong.json()["error"]["message"]

    bootstrap(client)
    signed = client.post("/api/v1/auth/login", json={"email": "ada@example.com", "password": PASSWORD})
    assert signed.status_code == 200
    assert_schema(signed.json(), "Session")
    assert signed.json()["user"]["role"] == "user"
    assert signed.json()["user"]["onboardingComplete"] is False
    current_cookie = signed.cookies.get("knowflow_session")
    assert current_cookie

    other_cookie = new_secret()
    db = app.state.sessionmaker()
    user = db.query(User).filter_by(email="ada@example.com").one()
    now = utcnow()
    db.add(
        AuthSession(
            id=new_id(),
            token_hash=digest(other_cookie),
            user_id=user.id,
            csrf_hash=digest(new_secret()),
            created_at=now,
            last_seen_at=now,
            expires_at=absolute_deadline(app.state.settings, now),
            idle_expires_at=idle_deadline(app.state.settings, now),
        )
    )
    db.commit()
    db.close()

    client.headers["X-CSRF-Token"] = client.get("/api/v1/session").json()["csrfToken"]
    changed = client.put("/api/v1/auth/password", json={"currentPassword": PASSWORD, "newPassword": "different-horse-2"})
    assert changed.status_code == 204
    assert changed.content == b""

    other = TestClient(app)
    other.__enter__()
    other.cookies.clear()
    blocked = other.get("/api/v1/settings", headers={"Cookie": f"knowflow_session={other_cookie}"})
    assert blocked.status_code == 401, blocked.text
    kept = other.get("/api/v1/settings", headers={"Cookie": f"knowflow_session={current_cookie}"})
    assert kept.status_code == 200
    assert kept.json()["email"] == "ada@example.com"
    other.__exit__(None, None, None)

    client.headers["X-CSRF-Token"] = client.get("/api/v1/session").json()["csrfToken"]
    again = client.post("/api/v1/auth/login", json={"email": "ada@example.com", "password": "different-horse-2"})
    assert again.status_code == 200
    reloaded = client.get("/api/v1/session")
    assert reloaded.json()["user"]["email"] == "ada@example.com"

    client.headers["X-CSRF-Token"] = reloaded.json()["csrfToken"]
    logged_out = client.post("/api/v1/auth/logout")
    assert logged_out.status_code == 200
    assert logged_out.json()["user"] is None
    assert client.get("/api/v1/settings").status_code == 401


def test_second_login_keeps_an_independent_session_until_password_change(client, app, caplog):
    from fastapi.testclient import TestClient

    register_and_verify(client, caplog)
    bootstrap(client)
    first = client.post("/api/v1/auth/login", json={"email": "ada@example.com", "password": PASSWORD})
    assert first.status_code == 200, first.text
    first_cookie = first.cookies.get("knowflow_session")
    assert first_cookie
    client.headers["X-CSRF-Token"] = first.json()["csrfToken"]

    phone = TestClient(app)
    phone.__enter__()
    try:
        phone.headers["Origin"] = "http://test.example"
        phone.headers["X-CSRF-Token"] = phone.get("/api/v1/session").json()["csrfToken"]
        second = phone.post("/api/v1/auth/login", json={"email": "ada@example.com", "password": PASSWORD})
        assert second.status_code == 200, second.text
        phone.headers["X-CSRF-Token"] = second.json()["csrfToken"]
        assert phone.cookies.get("knowflow_session") != first_cookie
        assert client.get("/api/v1/settings").status_code == 200
        assert phone.get("/api/v1/settings").status_code == 200
        laptop_note = client.post(
            "/api/v1/study-sessions",
            json={},
            headers={"Idempotency-Key": "laptop-session"},
        )
        assert laptop_note.status_code == 201, laptop_note.text

        client.headers["X-CSRF-Token"] = client.get("/api/v1/session").json()["csrfToken"]
        rotated = client.post("/api/v1/auth/login", json={"email": "ada@example.com", "password": PASSWORD})
        assert rotated.status_code == 200, rotated.text
        assert rotated.cookies.get("knowflow_session") != first_cookie
        client.headers["X-CSRF-Token"] = rotated.json()["csrfToken"]
        assert client.get("/api/v1/settings").status_code == 200
        assert phone.get("/api/v1/settings").status_code == 200
        retired = TestClient(app)
        retired.__enter__()
        try:
            retired.headers["Origin"] = "http://test.example"
            blocked = retired.get("/api/v1/settings", headers={"Cookie": f"knowflow_session={first_cookie}"})
            assert blocked.status_code == 401, blocked.text
        finally:
            retired.__exit__(None, None, None)

        changed = phone.put(
            "/api/v1/auth/password",
            json={"currentPassword": PASSWORD, "newPassword": "different-horse-2"},
        )
        assert changed.status_code == 204, changed.text
        assert phone.get("/api/v1/settings").status_code == 200
        assert client.get("/api/v1/settings").status_code == 401
    finally:
        phone.__exit__(None, None, None)


def test_verified_account_survives_a_new_process(database_url, caplog):
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
    first.state.engine.dispose()

    get_settings.cache_clear()
    restarted = create_app()
    with TestClient(restarted) as client:
        client.headers["Origin"] = "http://test.example"
        bootstrap(client)
        signed = client.post("/api/v1/auth/login", json={"email": "ada@example.com", "password": PASSWORD})
        assert signed.status_code == 200, signed.text
        assert signed.json()["user"]["email"] == "ada@example.com"
        client.headers["X-CSRF-Token"] = signed.json()["csrfToken"]
        assert client.get("/api/v1/settings").json()["name"] == "Ada Lovelace"
    restarted.state.engine.dispose()
    logging.getLogger("knowflow.verification").removeHandler(caplog.handler)


def test_rejects_missing_origin_csrf_and_self_assigned_admin(client):
    token = bootstrap(client)
    no_origin = client.post(
        "/api/v1/auth/login",
        headers={"Origin": "", "X-CSRF-Token": token},
        json={"email": "ada@example.com", "password": PASSWORD},
    )
    # TestClient may omit an empty origin; send a foreign one explicitly.
    foreign = client.post(
        "/api/v1/auth/login",
        headers={"Origin": "https://evil.example", "X-CSRF-Token": token},
        json={"email": "ada@example.com", "password": PASSWORD},
    )
    assert foreign.status_code == 403
    assert foreign.json()["error"]["code"] == "ORIGIN_REJECTED"
    client.headers.pop("X-CSRF-Token", None)
    missing = client.post("/api/v1/auth/login", json={"email": "ada@example.com", "password": PASSWORD})
    assert missing.status_code == 403
    assert missing.json()["error"]["code"] == "CSRF_FAILED"
    bootstrap(client)
    role = client.post(
        "/api/v1/auth/register",
        json={"name": "Ada", "email": "ada@example.com", "password": PASSWORD, "role": "admin"},
    )
    assert role.status_code == 422
    assert_schema(role.json(), "Error")
    assert no_origin.status_code in {403, 422}


def test_confirmation_requires_password_and_is_single_use(client, caplog, capsys):
    bootstrap(client)
    with caplog.at_level("INFO", logger="knowflow.verification"):
        client.post("/api/v1/auth/register", json={"name": "Ada", "email": "ada@example.com", "password": PASSWORD})
    token = verification_token(caplog, "registration", "ada@example.com")
    assert f"token={token}" in capsys.readouterr().out
    bootstrap(client)
    wrong = client.post("/api/v1/auth/email-verifications/confirm", json={"token": token, "password": "wrong-password-2"})
    assert wrong.status_code == 422
    bootstrap(client)
    ok = client.post("/api/v1/auth/email-verifications/confirm", json={"token": token, "password": PASSWORD})
    assert ok.status_code == 200
    assert ok.json()["user"] is None
    bootstrap(client)
    again = client.post("/api/v1/auth/email-verifications/confirm", json={"token": token, "password": PASSWORD})
    assert again.status_code == 400
    scanned = client.get(f"/api/v1/auth/email-verifications/confirm?token={token}")
    assert scanned.status_code == 405
    assert token not in scanned.text


def test_unverified_login_does_not_create_a_session(client, caplog):
    bootstrap(client)
    with caplog.at_level("INFO", logger="knowflow.verification"):
        client.post("/api/v1/auth/register", json={"name": "Ada", "email": "ada@example.com", "password": PASSWORD})
    bootstrap(client)
    denied = client.post("/api/v1/auth/login", json={"email": "ada@example.com", "password": PASSWORD})
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "EMAIL_VERIFICATION_REQUIRED"
    assert client.get("/api/v1/session").json()["user"] is None


def test_expired_session_becomes_anonymous(client, app, caplog):
    from datetime import timedelta

    from app.models import AuthSession
    from app.security import digest, utcnow

    register_and_verify(client, caplog)
    bootstrap(client)
    signed = client.post("/api/v1/auth/login", json={"email": "ada@example.com", "password": PASSWORD})
    assert signed.status_code == 200
    cookie = client.cookies.get("knowflow_session")
    db = app.state.sessionmaker()
    record = db.query(AuthSession).filter(AuthSession.token_hash == digest(cookie)).one()
    record.idle_expires_at = utcnow() - timedelta(seconds=5)
    db.commit()
    db.close()
    current = client.get("/api/v1/session")
    assert current.status_code == 200
    assert current.json()["user"] is None
