"""Gemini embedding adapter. Tests inject a fake. This module does not call the network unless a key is configured."""

from __future__ import annotations

EMBEDDING_MODEL = "gemini-embedding-001"
DIMENSION = 768
RETRIEVAL_DOCUMENT = "RETRIEVAL_DOCUMENT"
RETRIEVAL_QUERY = "RETRIEVAL_QUERY"
TASK_TYPES = {RETRIEVAL_DOCUMENT, RETRIEVAL_QUERY}


class EmbedError(Exception):
    def __init__(self, message: str, retryable: bool = False):
        super().__init__(message)
        self.retryable = retryable


def embedding_request(text: str, task_type: str, model: str = EMBEDDING_MODEL) -> dict:
    if task_type not in TASK_TYPES:
        raise EmbedError("The embedding task type is not approved.")
    return {
        "content": {"parts": [{"text": text[:8000]}]},
        "taskType": task_type,
        "outputDimensionality": DIMENSION,
    }


def embedding_url(model: str = EMBEDDING_MODEL) -> str:
    return f"https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent"


class GeminiEmbedder:
    configured = True
    model_id = EMBEDDING_MODEL

    def __init__(self, api_key: str, model: str = EMBEDDING_MODEL):
        self.api_key = api_key
        self.model_id = model or EMBEDDING_MODEL

    def embed(self, text: str, task_type: str) -> list[float]:
        import httpx

        if task_type not in TASK_TYPES:
            raise EmbedError("The embedding task type is not approved.")
        try:
            response = httpx.post(
                embedding_url(self.model_id),
                params={"key": self.api_key},
                json=embedding_request(text, task_type, self.model_id),
                timeout=12,
            )
        except httpx.TimeoutException as exc:
            raise EmbedError("Embedding timed out. Retry the failed item.", retryable=True) from exc
        except httpx.HTTPError as exc:
            raise EmbedError("Embedding is unavailable.", retryable=True) from exc
        if response.status_code == 429:
            raise EmbedError("Embedding is rate-limited. Retry later.", retryable=True)
        if response.status_code >= 300:
            raise EmbedError("Embedding was rejected by the provider.", retryable=response.status_code >= 500)
        try:
            values = response.json()["embedding"]["values"]
        except (KeyError, TypeError, ValueError) as exc:
            raise EmbedError("Embedding returned no vector.", retryable=True) from exc
        if not isinstance(values, list) or len(values) != DIMENSION:
            raise EmbedError("Embedding returned an incompatible vector.", retryable=False)
        return [float(item) for item in values]


class UnavailableEmbedder:
    configured = False
    model_id = EMBEDDING_MODEL

    def embed(self, text: str, task_type: str) -> list[float]:
        raise EmbedError("Embedding is not configured.")


def build_embedder(api_key: str, model: str = EMBEDDING_MODEL):
    if api_key:
        return GeminiEmbedder(api_key, model or EMBEDDING_MODEL)
    return UnavailableEmbedder()
