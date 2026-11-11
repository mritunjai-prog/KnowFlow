import json
import logging
import uuid

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import Settings, get_settings
from app.db import make_engine, make_session_factory
from app.errors import error_response
from app.identity import promote_configured_admins
from app.models import ServiceConfig
from app.catalog import DEFAULT_STORAGE_LIMIT, KNOWN_SOURCES
from app.classify import build_analyst
from app.embeddings import build_embedder
from app.generate import build_generator
from app.routers import admin, analytics, auth, capabilities, capture, library, onboarding, session, settings as settings_router, shares, study, tasks, assistant, meetings
from app.speech import build_speech
from app.storage import build_store
from app.transcribe import build_transcriber
from app.visual import build_visual

logger = logging.getLogger("knowflow.verification")


def _configure_verification_log() -> None:
    logger.disabled = False
    logger.setLevel(logging.INFO)
    logger.propagate = True


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    _configure_verification_log()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        db = app.state.sessionmaker()
        try:
            if db.get(ServiceConfig, 1) is None:
                db.add(
                    ServiceConfig(
                        id=1,
                        storage_limit_bytes=DEFAULT_STORAGE_LIMIT,
                        default_model_id=None,
                        capture_sources=json.dumps(list(KNOWN_SOURCES)),
                    )
                )
            promote_configured_admins(db, app.state.settings)
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()
        yield

    app = FastAPI(title="KnowFlow API", version="0.1.0", docs_url="/docs", redoc_url=None, lifespan=lifespan)
    engine = make_engine(settings)
    factory = make_session_factory(engine)
    app.state.settings = settings
    app.state.engine = engine
    app.state.sessionmaker = factory
    app.state.store = build_store(settings)
    app.state.transcriber = build_transcriber(settings.gemini_api_key, settings.gemini_model)
    app.state.speech = build_speech(settings.groq_api_key, settings.groq_model, settings.groq_zdr)
    app.state.classifier = build_analyst(settings.gemini_api_key, settings.gemini_model)
    app.state.embedder = build_embedder(settings.gemini_api_key)
    app.state.visual = build_visual(settings.gemini_api_key)
    app.state.generator = build_generator(settings.gemini_api_key, settings.gemini_model)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=sorted(settings.origins),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Accept", "Content-Type", "Idempotency-Key", "If-Match", "X-CSRF-Token", "X-Request-Id"],
    )

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
        request.state.request_id = request_id
        db = factory()
        request.state.db = db
        try:
            response = await call_next(request)
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()
        response.headers["X-Request-Id"] = request_id
        response.headers["Cache-Control"] = "no-store, private"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        fields: dict[str, str] = {}
        for item in exc.errors():
            loc = [str(part) for part in item.get("loc", []) if part not in {"body", "query", "path"}]
            fields[loc[-1] if loc else "request"] = "This value is invalid."
        return error_response(422, "VALIDATION_ERROR", "The request is invalid.", request, fields)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request: Request, exc: StarletteHTTPException):
        code = {401: "UNAUTHORIZED", 403: "FORBIDDEN", 404: "NOT_FOUND", 409: "CONFLICT"}.get(exc.status_code, "REQUEST_FAILED")
        message = exc.detail if isinstance(exc.detail, str) else "The request could not be completed."
        return error_response(exc.status_code, code, message, request)

    @app.exception_handler(SQLAlchemyError)
    async def database_error(request: Request, _exc: SQLAlchemyError):
        return error_response(503, "SERVICE_UNAVAILABLE", "The KnowFlow service is unavailable.", request)

    @app.exception_handler(Exception)
    async def unexpected(request: Request, _exc: Exception):
        return error_response(500, "INTERNAL_ERROR", "The request could not be completed.", request)

    @app.get("/healthz")
    def healthz():
        return {"status": "ok"}

    for module in (session, auth, settings_router, capabilities, admin, onboarding, capture, library, tasks, assistant, meetings, shares, analytics, study):
        app.include_router(module.router, prefix="/api/v1")

    return app


app = create_app()
