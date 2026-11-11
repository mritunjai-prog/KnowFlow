"""M6 audio transcription. Fakes only; no Groq, Gemini, R2, or Neon call."""

import json

from app.catalog import GROQ_MAX_AUDIO_BYTES, MAX_RECORDING_SECONDS
from app.extract import detect_media
from app.speech import ALLOWED_MODELS, GROQ_URL, build_speech, provider_error, transcription_form
from app.transcribe import TranscribeError
from tests.helpers import assert_schema, register_and_verify
from tests.test_m2_capture import finish, ingest, login
from tests.test_m4_retrieval import FakeEmbedder, poll_until
from tests.test_m5_meetings import DECISION, MeetingModel, meta

ACTION = "Please submit the lab report by 2026-12-01."
TRANSCRIPT = f"{DECISION} {ACTION}"
WEBM = b"\x1a\x45\xdf\xa3" + b"\x9f\x42\x86\x81\x01"


class FakeSpeech:
    configured = True
    model_id = "whisper-large-v3-turbo"

    def __init__(self, text=TRANSCRIPT):
        self.text = text
        self.calls = 0
        self.seen = []

    def transcribe(self, audio: bytes, media_type: str, name: str = "recording") -> str:
        self.calls += 1
        self.seen.append((audio[:4], media_type, name))
        if audio[:4] != WEBM[:4]:
            raise AssertionError("unexpected audio")
        return self.text


class FlakySpeech(FakeSpeech):
    def transcribe(self, audio: bytes, media_type: str, name: str = "recording") -> str:
        self.calls += 1
        if self.calls == 1:
            raise TranscribeError("Audio transcription timed out. Retry the recording.", retryable=True)
        return super().transcribe(audio, media_type, name)


def open_user(client, caplog, email="ada@example.com"):
    register_and_verify(client, caplog, email=email, name="Ada")
    login(client, email)


def audio_file(payload=WEBM, name="recording.webm"):
    return [("files", (name, payload, "application/octet-stream"))]


def test_signatures_and_adapter_do_not_allow_a_paid_fallback():
    assert detect_media(WEBM, "recording.webm") == "audio/webm"
    assert detect_media(b"OggS" + b"\x00" * 8, "clip.ogg") == "audio/ogg"
    assert detect_media(b"RIFF\x24\x00\x00\x00WAVE", "clip.wav") == "audio/wav"
    assert detect_media(b"fLaC\x00\x00\x00\x00", "clip.flac") == "audio/flac"
    assert detect_media(b"ID3\x03\x00\x00\x00\x00\x00\x00", "clip.mp3") == "audio/mpeg"
    assert detect_media(b"\x00\x00\x00\x18ftypM4A \x00\x00\x00\x00", "recording.m4a") == "audio/mp4"
    assert detect_media(b"not-audio", "recording.webm") is None
    assert detect_media(b"\x89PNG\r\n\x1a\n" + b"\x00" * 8, "recording.webm") == "image/png"
    form = transcription_form("whisper-large-v3-turbo")
    assert form["model"] in ALLOWED_MODELS
    assert form["temperature"] == "0"
    assert "whisper-large-v3-turbo" in GROQ_URL or GROQ_URL.endswith("/audio/transcriptions")
    assert "paid" not in json.dumps(form)
    try:
        transcription_form("gpt-4o-transcribe")
    except TranscribeError:
        pass
    else:
        raise AssertionError("paid model was accepted")
    assert "paid fallback" in str(provider_error(429)).lower()
    assert provider_error(429).retryable is True
    assert provider_error(400).retryable is False
    assert build_speech("", "whisper-large-v3-turbo", True).configured is False
    assert build_speech("key", "whisper-large-v3-turbo", False).configured is False
    assert build_speech("key", "gpt-4o-mini-transcribe", True).configured is False
    configured = build_speech("key", "whisper-large-v3", True)
    assert configured.configured is True
    assert configured.model_id == "whisper-large-v3"


def test_capabilities_advertise_audio_only_when_configured(client, app):
    closed = client.get("/api/v1/capabilities").json()
    assert closed["transcription"] is False
    assert "audio" not in closed["captureSources"]
    assert all(not item.startswith("audio/") for item in closed["acceptedMimeTypes"])
    assert all(model["available"] is False for model in closed["models"])
    app.state.speech = FakeSpeech()
    opened = client.get("/api/v1/capabilities").json()
    assert_schema(opened, "Capabilities")
    assert opened["transcription"] is True
    assert "audio" in opened["captureSources"]
    assert "audio/webm" in opened["acceptedMimeTypes"]
    assert "audio/ogg" in opened["acceptedMimeTypes"]
    assert "audio/mp4" in opened["acceptedMimeTypes"]
    assert opened["maxFileBytes"] == GROQ_MAX_AUDIO_BYTES
    assert opened["maxRecordingSeconds"] == MAX_RECORDING_SECONDS
    assert "api_key" not in json.dumps(opened).lower()


def test_uploaded_recording_plays_and_feeds_tasks_retrieval_and_meetings(client, caplog, app):
    app.state.speech = FakeSpeech()
    app.state.embedder = FakeEmbedder()
    app.state.generator = MeetingModel()
    open_user(client, caplog)
    created = ingest(client, text="", files=audio_file(), metadata=meta(captureSource="audio", title="Lecture recording"), key="audio-1")
    assert created.status_code == 202, created.text
    assert app.state.speech.calls == 0
    done = finish(client, created.json()["id"], limit=12)
    assert done["status"] == "succeeded", done
    assert app.state.speech.calls == 1
    document = client.get(f"/api/v1/documents/{done['items'][0]['documentId']}").json()
    assert document["sourceType"] == "audio"
    assert document["text"] == TRANSCRIPT
    assert document["meetingId"] == done["meetingId"]
    original = client.get(document["original"]["url"])
    assert original.status_code == 200, original.text
    assert original.headers["content-type"].startswith("audio/")
    assert original.content.startswith(WEBM[:4])
    partial = client.get(document["original"]["url"], headers={"Range": "bytes=0-3"})
    assert partial.status_code == 206
    assert partial.content == WEBM[:4]
    tasks = client.get("/api/v1/tasks").json()
    assert any("lab report" in item["description"].lower() for item in tasks["items"])
    asked = client.post(
        "/api/v1/assistant/query",
        data={"query": "What did we decide about packet routing?", "context": json.dumps({"conversationId": None, "documentIds": [document["id"]]})},
        headers={"Idempotency-Key": "audio-ask"},
    )
    answer = poll_until(client, asked.json()["id"])
    assert answer["answer"]["answer"]["sources"][0]["documentId"] == document["id"]
    finish(client, client.post(f"/api/v1/meetings/{done['meetingId']}/summarize").json()["id"], limit=8)
    meeting = client.get(f"/api/v1/meetings/{done['meetingId']}").json()
    assert meeting["decisions"] == [DECISION]
    patched = client.patch(f"/api/v1/documents/{document['id']}", json={"text": "The corrected transcript is about invoices and payment."})
    assert patched.status_code == 200, patched.text
    stale = client.get(f"/api/v1/meetings/{done['meetingId']}").json()
    assert stale["decisions"] == []
    assert "out of date" in stale["summary"]


def test_audio_limits_timeout_and_cancel(client, caplog, app):
    app.state.speech = FakeSpeech()
    open_user(client, caplog)
    rejected = ingest(client, text="", files=audio_file(b"not-audio", "recording.webm"), metadata=meta(captureSource="audio"), key="bad-codec")
    failed = finish(client, rejected.json()["id"], limit=4)
    assert failed["status"] == "failed"
    assert "not supported" in failed["items"][0]["error"].lower()
    oversized = WEBM + b"\x00" * (GROQ_MAX_AUDIO_BYTES - len(WEBM) + 1)
    too_big = ingest(client, text="", files=audio_file(oversized), metadata=meta(captureSource="audio"), key="too-big")
    assert too_big.status_code == 413
    assert "25 MB" in too_big.text
    app.state.speech = FlakySpeech()
    created = ingest(client, text="", files=audio_file(), metadata=meta(captureSource="audio"), key="timeout")
    timed = finish(client, created.json()["id"], limit=4)
    assert timed["status"] == "failed"
    assert timed["retryable"] is True
    assert "timed out" in timed["error"].lower() or "timed out" in timed["items"][0]["error"].lower()
    retried = client.post(f"/api/v1/jobs/{created.json()['id']}/retry")
    assert retried.status_code == 202
    assert finish(client, created.json()["id"], limit=12)["status"] == "succeeded"
    app.state.speech = FakeSpeech()
    queued = ingest(client, text="", files=audio_file(), metadata=meta(captureSource="audio"), key="cancel-audio")
    cancelled = client.post(f"/api/v1/jobs/{queued.json()['id']}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    assert client.get("/api/v1/documents").json()["total"] == 1
