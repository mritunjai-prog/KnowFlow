from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = Field(
        default="sqlite:///./knowflow.db",
        validation_alias=AliasChoices("DATABASE_URL", "KNOWFLOW_DATABASE_URL"),
    )
    allowed_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173",
        validation_alias="KNOWFLOW_ALLOWED_ORIGINS",
    )
    cookie_secure: bool = Field(default=True, validation_alias="KNOWFLOW_COOKIE_SECURE")
    admin_emails: str = Field(default="", validation_alias="KNOWFLOW_ADMIN_EMAILS")
    auth_rate_limit: int = Field(default=8, validation_alias="KNOWFLOW_AUTH_RATE_LIMIT")
    auth_rate_window_seconds: int = Field(default=900, validation_alias="KNOWFLOW_AUTH_RATE_WINDOW_SECONDS")
    session_idle_seconds: int = Field(default=24 * 60 * 60, validation_alias="KNOWFLOW_SESSION_IDLE_SECONDS")
    session_absolute_seconds: int = Field(
        default=7 * 24 * 60 * 60,
        validation_alias="KNOWFLOW_SESSION_ABSOLUTE_SECONDS",
    )
    verification_ttl_seconds: int = Field(default=30 * 60, validation_alias="KNOWFLOW_VERIFICATION_TTL_SECONDS")
    object_dir: str = Field(default="./.objects", validation_alias="KNOWFLOW_OBJECT_DIR")
    file_signing_key: str = Field(default="dev-only-change-me", validation_alias="KNOWFLOW_FILE_SIGNING_KEY")
    gemini_api_key: str = Field(default="", validation_alias="GEMINI_API_KEY")
    gemini_model: str = Field(default="gemini-3.8-flash", validation_alias="KNOWFLOW_GEMINI_MODEL")
    groq_api_key: str = Field(default="", validation_alias="GROQ_API_KEY")
    groq_model: str = Field(default="whisper-large-v3-turbo", validation_alias="KNOWFLOW_GROQ_MODEL")
    groq_zdr: bool = Field(default=False, validation_alias="KNOWFLOW_GROQ_ZDR")
    r2_account_id: str = Field(default="", validation_alias="R2_ACCOUNT_ID")
    r2_access_key_id: str = Field(default="", validation_alias="R2_ACCESS_KEY_ID")
    r2_secret_access_key: str = Field(default="", validation_alias="R2_SECRET_ACCESS_KEY")
    r2_bucket: str = Field(default="", validation_alias="R2_BUCKET")

    app_name: str = Field(default="KnowFlow")

    @property
    def origins(self) -> set[str]:
        return {item.strip().rstrip("/") for item in self.allowed_origins.split(",") if item.strip()}

    @property
    def r2_ready(self) -> bool:
        return bool(self.r2_account_id and self.r2_access_key_id and self.r2_secret_access_key and self.r2_bucket)

    @property
    def admin_email_set(self) -> set[str]:
        return {item.strip().lower() for item in self.admin_emails.split(",") if item.strip()}

    @property
    def sqlalchemy_url(self) -> str:
        url = self.database_url
        if url.startswith("postgres://"):
            return "postgresql+psycopg://" + url[len("postgres://") :]
        if url.startswith("postgresql://") and "+psycopg" not in url.split("://", 1)[0]:
            return "postgresql+psycopg://" + url[len("postgresql://") :]
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()
