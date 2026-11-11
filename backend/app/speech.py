"""Groq Whisper adapter. Tests inject a fake. No paid fallback and no call unless ZDR is confirmed."""

from __future__ import annotations

from app.catalog import GROQ_MAX_AUDIO_BYTES
from app.transcribe import TranscribeError

GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
ALLOWED_MODELS = {"whisper-large-v3-turbo", "whisper-large-v3"}
EXTENSIONS = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "audio/flac": "flac",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
}


def transcription_form(model: str) -> dict[str, str]:
    if model not in ALLOWED_MODELS:
        raise TranscribeError("The transcription model is not approved.")
    return {"model": model, "temperature": "0", "response_format": "json"}


def provider_error(status: int) -> TranscribeError:
    if status == 429:
        return TranscribeError(
            "Audio transcription is rate-limited. Retry later. No paid fallback is available.",
            retryable=True,
        )
    if status == 413:
        return TranscribeError("The recording exceeds the 25 MB free transcription limit.", retryable=False)
    if status in {400, 415, 422}:
        return TranscribeError("This audio codec is not supported.", retryable=False)
    if status >= 500:
        return TranscribeError("Audio transcription is unavailable.", retryable=True)
    return TranscribeError("Audio transcription was rejected.", retryable=False)


class GroqSpeech:
    configured = True

    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model_id = model

    def transcribe(self, audio: bytes, media_type: str, name: str = "recording") -> str:
        import httpx

        if len(audio) > GROQ_MAX_AUDIO_BYTES:
            raise TranscribeError("The recording exceeds the 25 MB free transcription limit.", retryable=False)
        extension = EXTENSIONS.get(media_type, "bin")
        filename = f"recording.{extension}"
        try:
            response = httpx.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {self.api_key}"},
                data=transcription_form(self.model_id),
                files={"file": (filename, audio, media_type)},
                timeout=12,
            )
        except httpx.TimeoutException as exc:
            raise TranscribeError("Audio transcription timed out. Retry the recording.", retryable=True) from exc
        except httpx.HTTPError as exc:
            raise TranscribeError("Audio transcription is unavailable.", retryable=True) from exc
        if response.status_code >= 300:
            raise provider_error(response.status_code)
        try:
            text = str(response.json().get("text") or "").strip()
        except ValueError as exc:
            raise TranscribeError("Audio transcription returned no text.", retryable=True) from exc
        if not text:
            raise TranscribeError("No speech could be transcribed.", retryable=False)
        return text


class UnavailableSpeech:
    configured = False
    model_id = "whisper-large-v3-turbo"

    def transcribe(self, audio: bytes, media_type: str, name: str = "recording") -> str:
        raise TranscribeError("Audio transcription is not configured.")


def build_speech(api_key: str, model: str, zdr_confirmed: bool):
    chosen = model or "whisper-large-v3-turbo"
    if api_key and zdr_confirmed and chosen in ALLOWED_MODELS:
        return GroqSpeech(api_key, chosen)
    return UnavailableSpeech()
