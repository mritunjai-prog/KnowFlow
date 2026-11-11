"""Gemini Vision transcription. Tests inject a fake. This module does not call the network by itself."""

import base64

PINNED_MODEL = "gemini-3.8-flash"
PROMPT = (
    "Transcribe all printed and handwritten text in this page image. "
    "Preserve line breaks. Do not summarize, translate, or invent missing words. "
    "If a region is unreadable, write [unreadable]. Return only the transcription."
)


class TranscribeError(Exception):
    def __init__(self, message: str, retryable: bool = False):
        super().__init__(message)
        self.retryable = retryable


def transcription_request(jpeg: bytes, model: str = PINNED_MODEL) -> dict:
    """Request body for one page. No tools and no search grounding."""
    return {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": PROMPT},
                    {"inline_data": {"mime_type": "image/jpeg", "data": base64.b64encode(jpeg).decode("ascii")}},
                ],
            }
        ],
        "generationConfig": {"temperature": 0, "maxOutputTokens": 4096},
    }


class GeminiTranscriber:
    configured = True

    def __init__(self, api_key: str, model: str = PINNED_MODEL):
        self.api_key = api_key
        self.model = model

    def transcribe(self, jpeg: bytes) -> str:
        import httpx

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
        try:
            response = httpx.post(
                url,
                params={"key": self.api_key},
                json=transcription_request(jpeg, self.model),
                timeout=12,
            )
        except httpx.TimeoutException as exc:
            raise TranscribeError("Page transcription timed out. Retry the failed item.", retryable=True) from exc
        except httpx.HTTPError as exc:
            raise TranscribeError("Page transcription is unavailable.", retryable=True) from exc
        if response.status_code == 429:
            raise TranscribeError("Page transcription is rate-limited. Retry later.", retryable=True)
        if response.status_code >= 300:
            raise TranscribeError("Page transcription was rejected by the provider.", retryable=response.status_code >= 500)
        try:
            body = response.json()
            parts = body["candidates"][0]["content"]["parts"]
            text = "\n".join(part.get("text", "") for part in parts).strip()
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise TranscribeError("Page transcription returned no text.", retryable=True) from exc
        if not text:
            raise TranscribeError("Page transcription returned no text.", retryable=True)
        return text


class UnavailableTranscriber:
    configured = False

    def transcribe(self, jpeg: bytes) -> str:
        raise TranscribeError("Page transcription is not configured.")


def build_transcriber(api_key: str, model: str):
    if api_key:
        return GeminiTranscriber(api_key, model or PINNED_MODEL)
    return UnavailableTranscriber()
