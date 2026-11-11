"""Opaque model catalog. Vision is available only when a transcriber is configured."""

KNOWN_SOURCES = ("file", "camera", "text", "audio")
DIGITAL_SOURCES = ("file", "text")
DOCUMENT_TYPES = ("lecture note", "assignment", "project report", "bill", "other")
TOPICS = ("networks", "databases", "algorithms", "calculus", "accounting", "scheduling")
ACCEPTED_DIGITAL = (
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
)
ACCEPTED_IMAGES = ("image/jpeg", "image/png", "image/webp")
ACCEPTED_AUDIO = ("audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/flac")
MAX_FILE_BYTES = 25 * 1024 * 1024
GROQ_MAX_AUDIO_BYTES = 25 * 1024 * 1024
MAX_RECORDING_SECONDS = 15 * 60
MAX_BATCH_FILES = 10
MAX_TEXT_CHARACTERS = 100_000

# IDs are stable preferences only. available stays false until a later milestone
# actually configures an adapter. Do not invent a live Gemini snapshot here.
MODELS = (
    {"id": "gemini-embedding-001", "label": "Gemini text embeddings", "available": False},
    {"id": "gemini-flash", "label": "Gemini Flash", "available": False},
    {"id": "whisper-large-v3-turbo", "label": "Groq Whisper", "available": False},
    {"id": "whisper-large-v3", "label": "Groq Whisper large", "available": False},
)

DEFAULT_STORAGE_LIMIT = 8 * 1024 * 1024 * 1024
MAX_SAFE_INTEGER = 9_007_199_254_740_991


def model_ids() -> set[str]:
    return {item["id"] for item in MODELS}


def available_model_ids(vision: bool = False) -> set[str]:
    if not vision:
        return set()
    return {"gemini-flash"}
