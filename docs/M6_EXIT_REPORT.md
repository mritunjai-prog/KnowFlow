# M6 exit report

Date: 2026-11-11. Scope: audio transcription integrated end to end. This is a local verification record, not a deployment, device, or provider-quality claim.

Authority: BRD §§4.2 and 14, `docs/M0_DECISION_RECORD.md` §3 audio pin, and the published ingestion, document, and capabilities shapes. `docs/openapi.json` and `frontend/` were not edited.

## What landed

- Audio is an ordinary ingestion file. `detect_media` accepts `audio/webm`, `audio/ogg`, `audio/mp4`, `audio/mpeg`, `audio/wav`, and `audio/flac` only when the bytes match that container. A renamed image or random bytes are rejected. The recorder's webm, ogg, and mp4/m4a names are the shapes the frozen Capture page can submit.
- Files larger than 25 MB are rejected before storage. That is the Groq free-tier file cap from the M0 record. There is no second, larger limit and no paid per-hour path.
- A configured transcription stores the original recording and returns it through the existing signed file URL. The file response accepts a byte range so the document player can seek. The URL still expires and is not a share of the meeting.
- Transcription is one poll step inside the existing job. The database commit happens before the provider call. Timeout, HTTP 429, unsupported codec, and an empty transcript fail the item with an explicit message. HTTP 429 says to retry later and that no paid fallback is available. The approved models are only `whisper-large-v3-turbo` and `whisper-large-v3`.
- The adapter is not configured unless `GROQ_API_KEY` is set and `KNOWFLOW_GROQ_ZDR=true`. The M0 record says not to send recordings when Zero Data Retention cannot be confirmed. This flag is the operator's confirmation. It is not a live check of the Groq account.
- A saved transcript uses the same classify, action, chunk, embed, and meeting paths as extracted text. `sourceType` is `audio`. The meeting id from intake is kept. `PATCH /documents/{id}` on the transcript bumps the index version, marks old chunks stale, and makes the meeting summary show that it is out of date.
- `GET /capabilities` adds audio MIME types and the `audio` capture source only when the speech adapter is configured. `transcription` is that same flag, because the frozen recorder uses it. `maxFileBytes` stays 25 MB. `maxRecordingSeconds` is 900, a 15-minute browser cap chosen so a common recording bitrate stays under 25 MB. The hard rejection remains the file size.
- Whisper stays `available: false` in the model list. The frozen Settings control treats an available model as an answer model, and Whisper is not the answer model. Audio availability is the transcription flag, the audio source, and the audio MIME types.

## Checks

`PYTHONPATH=/home/user/KnowFlow/backend /tmp/knowflow-m1/bin/pytest -q backend/tests` → **47 passed, 1 warning in 31.10s**.

The warning is Starlette's `httpx`/`httpx2` TestClient notice. The run includes M1–M6. Tests inject a fake speech adapter. No test calls Groq, Gemini, R2, or Neon.

Covered locally:

- container signatures and rejection of a renamed image
- the request builder allows only the two approved Whisper models and maps HTTP 429 to a retryable stop with no paid model
- the adapter stays off without a key, without the ZDR flag, or with an unapproved model id
- capabilities hide audio until the adapter is configured, then advertise the MIME types, 25 MB cap, and 15-minute recording limit
- an uploaded recording is stored, playable through the signed URL, classified, turned into a task, embedded, and used by a meeting summary
- a transcript edit makes the meeting summary stale
- an unsupported file, a file over 25 MB, a timeout, retry, and cancel-before-transcription behave as failed or cancelled jobs without leaving an extra document

## Not done

- No physical microphone, permission-denial, or browser-codec test. The existing Capture page already explains permission denial and asks for participants' permission before upload. That copy was not changed.
- No labeled-clip word-error-rate measurement. No recording was sent to Groq.
- No Render, Neon, Cloudflare, Gemini, or Groq call.
- This work is uncommitted. `main` was not changed.
