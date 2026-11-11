import json

from fastapi import APIRouter, Request
from sqlalchemy import select

from app.catalog import (
    ACCEPTED_AUDIO,
    ACCEPTED_DIGITAL,
    ACCEPTED_IMAGES,
    DOCUMENT_TYPES,
    TOPICS,
    KNOWN_SOURCES,
    MAX_BATCH_FILES,
    MAX_FILE_BYTES,
    MAX_RECORDING_SECONDS,
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
    speech = bool(getattr(request.app.state, "speech", None) and request.app.state.speech.configured)
    visual = bool(getattr(request.app.state, "visual", None) and request.app.state.visual.configured)
    implemented = ["file", "text"] + (["camera"] if vision else []) + (["audio"] if speech else [])
    advertised = [source for source in enabled if source in implemented]
    mimes = list(ACCEPTED_DIGITAL)
    if vision and ("file" in advertised or "camera" in advertised):
        mimes.extend(ACCEPTED_IMAGES)
    if speech and ("file" in advertised or "audio" in advertised):
        mimes.extend(ACCEPTED_AUDIO)
    models = []
    for item in MODELS:
        available = item["id"] == "gemini-flash" and vision
        models.append(ModelOption(id=item["id"], label=item["label"], available=available))
    return CapabilitiesOut(
        acceptedMimeTypes=mimes,
        maxFileBytes=MAX_FILE_BYTES,
        maxBatchFiles=MAX_BATCH_FILES,
        maxTextCharacters=MAX_TEXT_CHARACTERS,
        maxRecordingSeconds=MAX_RECORDING_SECONDS,
        captureSources=advertised,
        documentTypes=list(DOCUMENT_TYPES),
        topics=list(TOPICS),
        models=models,
        multimodal=visual,
        transcription=speech,
    )
