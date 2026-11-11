from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text

from app.security import hash_password, new_id, utcnow


def alembic_config(url: str) -> Config:
    import os

    os.environ["KNOWFLOW_ALEMBIC_URL"] = url
    root = Path(__file__).resolve().parents[1]
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "alembic"))
    config.set_main_option("sqlalchemy.url", url)
    return config


def test_migration_round_trip_and_row_restore(tmp_path: Path):
    source_url = f"sqlite:///{tmp_path / 'source.db'}"
    config = alembic_config(source_url)
    command.upgrade(config, "head")
    command.downgrade(config, "base")
    command.upgrade(config, "head")

    now = utcnow()
    row = {
        "id": new_id(),
        "name": "Ada",
        "email": "ada@example.com",
        "password_hash": hash_password("correct-horse-1"),
        "role": "user",
        "onboarding_complete": False,
        "email_verified_at": now,
        "capture_source": "file",
        "model_id": None,
        "created_at": now,
        "updated_at": now,
    }
    source = create_engine(source_url)
    with source.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO users (id, name, email, password_hash, role, onboarding_complete, "
                "email_verified_at, capture_source, model_id, created_at, updated_at) "
                "VALUES (:id, :name, :email, :password_hash, :role, :onboarding_complete, "
                ":email_verified_at, :capture_source, :model_id, :created_at, :updated_at)"
            ),
            row,
        )
        stored = connection.execute(text("SELECT id, email, role, password_hash FROM users")).mappings().one()
    source.dispose()

    restored_url = f"sqlite:///{tmp_path / 'restored.db'}"
    command.upgrade(alembic_config(restored_url), "head")
    restored = create_engine(restored_url)
    with restored.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO users (id, name, email, password_hash, role, onboarding_complete, "
                "email_verified_at, capture_source, model_id, created_at, updated_at) "
                "VALUES (:id, :name, :email, :password_hash, :role, :onboarding_complete, "
                ":email_verified_at, :capture_source, :model_id, :created_at, :updated_at)"
            ),
            row,
        )
        copied = connection.execute(text("SELECT id, email, role, password_hash FROM users")).mappings().one()
    restored.dispose()
    assert dict(copied) == dict(stored)
