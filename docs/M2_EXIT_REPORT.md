# M2 exit report — real capture-to-library processing

Date checked: 2026-11-10. No deployment, live Gemini call, live R2 call, or `main` merge was made.

## Verification

```text
cd backend
PYTHONPATH=/home/user/KnowFlow/backend /tmp/knowflow-m1/bin/pytest -q
21 passed, 1 warning in 9.78s
```

The warning is Starlette's existing notice that its bundled TestClient wants `httpx2`. It is not an application failure. The same isolated venv reran the complete M1 suite with these tests; M1 still passes. SQLite was the test database. Gemini and Cloudflare were mocked or represented by local signing only.

## Gate

| Exit condition | Result |
| --- | --- |
| Ownership | A second account receives 404 for another user's job and document and sees an empty library. |
| Restart survival | The ingestion returns 202 before processing. A new process resumes the stored job and completes it. |
| Partial mixed batch | A valid text file and a malformed binary produce one success and one safe failure. |
| Same-key retry | Replaying the same Idempotency-Key and payload returns the same job and does not duplicate the document. |
| Mismatched payload | The same key with different content returns 409 `IDEMPOTENCY_CONFLICT`. |
| Cancel | Cancelling a queued job is repeatable, returns `cancelled`, and retry is rejected. Completed items are retained when a failed sibling is retried. |
| Malformed files | An empty or unrecognized file fails that item without exposing a parser exception. |
| No boundary | A flat image records `No document boundary was detected.` and still transcribes through the mocked adapter. |
| Editable text | `PATCH /documents/{id}` changes the extracted text. |
| Provider isolation | Tests do not call Gemini or R2. The transcription request builder pins `gemini-3.8-flash` and includes no tools or search grounding. |

## What is now real

- `POST /api/v1/ingestions` accepts text, PDF, DOCX, and image fixtures, persists the job before 202, and honors idempotency.
- `GET /api/v1/jobs/{id}` performs one short stored step per poll. Image work and transcription happen after the database session is released.
- Local OpenCV detects a document boundary, applies perspective correction when found, and enhances contrast. It does not OCR.
- The Gemini adapter is present but returns an explicit unavailable result when no key is configured. Tests use a fake transcriber.
- Originals, processed images, and thumbnails are stored through the storage adapter. Tests use the local signed-file adapter. The R2 adapter is implemented for the approved host but was not called.
- `GET /documents`, `GET /documents/{id}`, `PATCH /documents/{id}`, and `GET /timeline` return persisted records in the published DTO shapes. Timeline filters use the requested IANA timezone.

## Honest boundaries

- Audio, embeddings, semantic search, study tools, sharing management, and assistant responses are not implemented. Capabilities advertise `file` and `text` only, with `transcription: false` and `multimodal: false`, because no vision key is configured in tests.
- Library search is lexical, not semantic. `index_state` remains `pending`.
- `summary` currently carries the preprocessing note. It is not a model-written summary.
- The frontend and `docs/openapi.json` were not changed. The two acknowledged M1 contract gaps remain deferred.
