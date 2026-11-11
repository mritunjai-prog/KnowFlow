import json

from fastapi import APIRouter, Request
from sqlalchemy import select

from app.catalog import (
    ACCEPTED_DIGITAL,
    ACCEPTED_IMAGES,
    DOCUMENT_TYPES,
    KNOWN_SOURCES,
    MAX_BATCH_FILES,
    MAX_FILE_BYTES,
    MAX_TEXT_CHARACTERS,
    MODELS,
)
from app.models import ServiceConfig
from app.schemas import CapabilitiesOut, ModelOption

router = APIRouter()


@router.get("/capabilities")
def get_capabilities(request: Request):
    config = request.state.db.scalar(select(ServiceConfig).where(ServiceConfig.id == 1))
    enabled = json.loads(config.capture_sources) if config else list(KNOWN_SOURCES)
    vision = bool(getattr(request.app.state, "transcriber", None) and request.app.state.transcriber.configured)
    implemented = ["file", "text"] + (["camera"] if vision else [])
    advertised = [source for source in enabled if source in implemented]
    mimes = list(ACCEPTED_DIGITAL)
    if vision and ("file" in advertised or "camera" in advertised):
        mimes.extend(ACCEPTED_IMAGES)
    models = []
    for item in MODELS:
        available = item["id"] == "gemini-flash" and vision
        models.append(ModelOption(id=item["id"], label=item["label"], available=available))
    return CapabilitiesOut(
        acceptedMimeTypes=mimes,
        maxFileBytes=MAX_FILE_BYTES,
        maxBatchFiles=MAX_BATCH_FILES,
        maxTextCharacters=MAX_TEXT_CHARACTERS,
        maxRecordingSeconds=3600,
        captureSources=advertised,
        documentTypes=list(DOCUMENT_TYPES),
        topics=[],
        models=models,
        multimodal=False,
        transcription=False,
    )
