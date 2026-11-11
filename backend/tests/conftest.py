import logging
import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app

ORIGIN = "http://test.example"


@pytest.fixture()
def database_url(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> str:
    url = f"sqlite:///{tmp_path / 'knowflow.db'}"
    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.setenv("KNOWFLOW_COOKIE_SECURE", "false")
    monkeypatch.setenv("KNOWFLOW_ALLOWED_ORIGINS", ORIGIN)
    monkeypatch.setenv("KNOWFLOW_ADMIN_EMAILS", "admin@example.com")
    monkeypatch.setenv("KNOWFLOW_AUTH_RATE_LIMIT", "8")
    monkeypatch.setenv("KNOWFLOW_ALEMBIC_URL", url)
    monkeypatch.setenv("KNOWFLOW_OBJECT_DIR", str(tmp_path / "objects"))
    monkeypatch.setenv("KNOWFLOW_FILE_SIGNING_KEY", "test-signing-key")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    get_settings.cache_clear()
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    config.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "alembic"))
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "head")
    return url


@pytest.fixture()
def app(database_url: str):
    get_settings.cache_clear()
    application = create_app()
    yield application
    application.state.engine.dispose()


@pytest.fixture()
def client(app, caplog):
    logger = logging.getLogger("knowflow.verification")
    logger.addHandler(caplog.handler)
    with TestClient(app) as test_client:
        test_client.headers["Origin"] = ORIGIN
        yield test_client
    logger.removeHandler(caplog.handler)
