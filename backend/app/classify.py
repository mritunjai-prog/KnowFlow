"""Document and action adapters. Tests inject a fake. No network call happens unless a key is configured."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime

from app.catalog import DOCUMENT_TYPES, TOPICS
from app.ml import MODEL_ID, get_model
from app.transcribe import PINNED_MODEL

CLASSIFY_PROMPT = (
    "Classify this personal academic document. Return JSON with keys documentType and topics. "
    f"documentType must be one of: {', '.join(DOCUMENT_TYPES)}. "
    f"topics must be an array containing only these labels: {', '.join(TOPICS)}. "
    "Use an empty topics array when none apply. Do not explain. Do not call tools."
)
ACTION_PROMPT = (
    "Extract actionable obligations from this text. Return JSON with key tasks, an array of objects "
    "with description, priority (low, medium, or high), dueDate (YYYY-MM-DD or null), and excerpt. "
    "excerpt must be a verbatim sentence from the text. Do not invent dates or obligations. Do not call tools."
)
ISO_DATE = re.compile(r"\b(20\d{2})-(\d{2})-(\d{2})\b")
MONTHS = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
}
WRITTEN_DATE = re.compile(
    r"\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(20\d{2})\b",
    re.IGNORECASE,
)
DAY_MONTH_DATE = re.compile(
    r"\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(20\d{2})\b",
    re.IGNORECASE,
)


class ClassifyError(Exception):
    def __init__(self, message: str, retryable: bool = False):
        super().__init__(message)
        self.retryable = retryable


def parse_due_date(text: str) -> str | None:
    match = ISO_DATE.search(text)
    if match:
        return _calendar(int(match.group(1)), int(match.group(2)), int(match.group(3)))
    written = WRITTEN_DATE.search(text)
    if written:
        return _calendar(int(written.group(3)), MONTHS[written.group(1).lower()], int(written.group(2)))
    day_first = DAY_MONTH_DATE.search(text)
    if day_first:
        return _calendar(int(day_first.group(3)), MONTHS[day_first.group(2).lower()], int(day_first.group(1)))
    return None


def _calendar(year: int, month: int, day: int) -> str | None:
    try:
        datetime(year, month, day)
    except ValueError:
        return None
    return f"{year:04d}-{month:02d}-{day:02d}"


def sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+|\n+", text)
    return [part.strip() for part in parts if part.strip()]


def normalize(text: str) -> str:
    return " ".join(text.lower().split())


def grounded(text: str, excerpt: str) -> bool:
    return bool(excerpt.strip()) and normalize(excerpt) in normalize(text)


def fingerprint(page: int | None, excerpt: str) -> str:
    return hashlib.sha256(f"{page or 0}|{normalize(excerpt)}".encode()).hexdigest()


def classification_request(text: str, title: str = "", model: str = PINNED_MODEL) -> dict:
    body = f"{CLASSIFY_PROMPT}\n\nTitle: {title[:200]}\n\n{text[:8000]}"
    return {
        "contents": [{"role": "user", "parts": [{"text": body}]}],
        "generationConfig": {"temperature": 0, "maxOutputTokens": 512, "responseMimeType": "application/json"},
    }


def action_request(text: str, model: str = PINNED_MODEL) -> dict:
    return {
        "contents": [{"role": "user", "parts": [{"text": f"{ACTION_PROMPT}\n\n{text[:8000]}"}]}],
        "generationConfig": {"temperature": 0, "maxOutputTokens": 1024, "responseMimeType": "application/json"},
    }


class LocalAnalyst:
    configured = True
    provider = "local"
    model_id = MODEL_ID

    def classify(self, text: str, title: str = "") -> dict:
        return get_model().classify(f"{title}\n{text}".strip())

    def detect_actions(self, text: str, page: int | None = 1) -> list[dict]:
        found = []
        model = get_model()
        for sentence in sentences(text):
            if model.action_probability(sentence) < 0.5 or not grounded(text, sentence):
                continue
            found.append(_action(sentence, model.priority(sentence), parse_due_date(sentence), page))
            if len(found) >= 20:
                break
        return found


class GeminiAnalyst:
    configured = True
    provider = "gemini"

    def __init__(self, api_key: str, model: str = PINNED_MODEL):
        self.api_key = api_key
        self.model = model or PINNED_MODEL
        self.model_id = self.model

    def classify(self, text: str, title: str = "") -> dict:
        parsed = _json_object(self._generate(classification_request(text, title, self.model)))
        document_type = parsed.get("documentType")
        if document_type not in DOCUMENT_TYPES:
            document_type = "other"
        topics = [item for item in parsed.get("topics") or [] if item in TOPICS]
        return {
            "modelId": self.model_id,
            "documentType": document_type,
            "topics": topics,
            "clusterTopics": [],
            "typeScores": {},
        }

    def detect_actions(self, text: str, page: int | None = 1) -> list[dict]:
        parsed = _json_object(self._generate(action_request(text, self.model)))
        found = []
        for item in parsed.get("tasks") or []:
            if not isinstance(item, dict):
                continue
            excerpt = str(item.get("excerpt") or item.get("description") or "").strip()
            if not grounded(text, excerpt):
                continue
            priority = item.get("priority") if item.get("priority") in {"low", "medium", "high"} else "medium"
            due = item.get("dueDate")
            if not isinstance(due, str) or parse_due_date(excerpt) != due:
                due = parse_due_date(excerpt)
            found.append(_action(excerpt, priority, due, page))
            if len(found) >= 20:
                break
        return found

    def _generate(self, payload: dict) -> str:
        import httpx

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
        try:
            response = httpx.post(url, params={"key": self.api_key}, json=payload, timeout=12)
        except httpx.TimeoutException as exc:
            raise ClassifyError("Classification timed out. Retry the failed item.", retryable=True) from exc
        except httpx.HTTPError as exc:
            raise ClassifyError("Classification is unavailable.", retryable=True) from exc
        if response.status_code == 429:
            raise ClassifyError("Classification is rate-limited. Retry later.", retryable=True)
        if response.status_code >= 300:
            raise ClassifyError("Classification was rejected by the provider.", retryable=response.status_code >= 500)
        try:
            parts = response.json()["candidates"][0]["content"]["parts"]
            text = "\n".join(part.get("text", "") for part in parts).strip()
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise ClassifyError("Classification returned no result.", retryable=True) from exc
        if not text:
            raise ClassifyError("Classification returned no result.", retryable=True)
        return text


def _json_object(text: str) -> dict:
    try:
        value = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ClassifyError("Classification returned an unreadable result.", retryable=True) from exc
    if not isinstance(value, dict):
        raise ClassifyError("Classification returned an unreadable result.", retryable=True)
    return value


def _action(excerpt: str, priority: str, due: str | None, page: int | None) -> dict:
    return {
        "description": excerpt[:2000],
        "priority": priority if priority in {"low", "medium", "high"} else "medium",
        "dueDate": due,
        "excerpt": excerpt[:500],
        "page": page,
        "fingerprint": fingerprint(page, excerpt),
    }


def build_analyst(api_key: str, model: str):
    if api_key:
        return GeminiAnalyst(api_key, model or PINNED_MODEL)
    return LocalAnalyst()
