# M7 exit report

Date: 2026-11-11. Scope: actual multimodal retrieval. This is a local verification record, not a deployment, device, or provider-quality claim.

Authority: BRD §§4.2 and 14, the M7 roadmap exit gate, the published `Source.region` and `capabilities.multimodal` shapes, and the M7 amendment in `docs/M0_DECISION_RECORD.md`. `docs/openapi.json` and `frontend/` were not edited.

## What landed

- Page images are a separate visual index. `gemini-embedding-2` embeds one JPEG region per poll at 768 dimensions. Text stays on `gemini-embedding-001` with `RETRIEVAL_DOCUMENT` / `RETRIEVAL_QUERY`. The visual vectors are stored in `visual_regions`, including a Postgres `vector(768)` column of their own. They are never written into `document_chunks.embedding`. Equal length is not treated as compatibility.
- OpenCV finds content boxes on the stored processed page and normalizes them to `[x, y, width, height]`. If no inner box is found, the stored page itself is `[0, 0, 1, 1]`. A region that does not fit that image is not saved and is not returned. This does not change the transcription warp path.
- An optional query image is accepted on the existing async assistant job only when the visual adapter is configured. The 202 response does not call a provider. PNG and JPEG are accepted. WebP, which the frozen Assistant page can submit, is converted locally to JPEG because the embedding guide allows PNG and JPEG only. The image is embedded on a later poll.
- Text and visual searches run separately. Both are limited to documents the caller owns or has an accepted grant for, and to the selected `documentIds` when that list is not empty. That filter happens before the prompt is built, and access is checked again before the answer is saved. One retrieved region image may be sent with the excerpts. It is marked untrusted. The model does not invent the coordinates.
- If neither search clears the local similarity floor, or the generator cannot support a claim, the answer abstains. A saved citation that later loses access or a current region is redacted on read, including its coordinates.
- A text correction still rebuilds text chunks. It does not discard the visual index of an unchanged page image.
- `GET /capabilities` sets `multimodal` only when the visual adapter is configured. A Gemini key configures it. Tests can inject a fake. The visual model is not listed as an answer model, because the frozen Settings control treats every available model as one. HTTP 429 stops the step and says there is no paid fallback. The batch embedding API is not used.

## Checks

`PYTHONPATH=/home/user/KnowFlow/backend /tmp/knowflow-m1/bin/pytest -q backend/tests` → **53 passed, 1 warning in 37.01s**.

The warning is Starlette's `httpx`/`httpx2` TestClient notice. The run includes M1–M7. Tests inject fakes. No test calls Gemini, Groq, R2, or Neon.

Covered locally:

- visual requests use `gemini-embedding-2`, 768 dimensions, no `taskType`, and no batch endpoint; text requests stay on `gemini-embedding-001`
- a short provider vector is rejected; HTTP 429 is retryable and names the lack of a paid fallback
- content boxes are normalized and overlap the drawn mark on a synthetic page
- an image query cites that page and region when the OCR text does not match the question; a blue page and an invoice note are not cited
- restricting `documentIds` to the invoice abstains
- an outsider cannot query the owner's page; an accepted viewer can; revocation removes the saved region
- a text correction does not remove the visual citation
- an unsupported image is rejected; cancel before the first poll does not call the embedder; a different image with the same idempotency key is a 409
- `multimodal` stays false when only the text embedder and transcriber are configured

## Conflicts

- M0 previously forbade a visual index until a later decision. M7 is that decision. The amendment is in `docs/M0_DECISION_RECORD.md` §7. Text embeddings were not switched to `gemini-embedding-2`.
- M0 said `gemini-embedding-2` was only a text fallback if `gemini-embedding-001` was unavailable. It is now also the visual model. The text index is unchanged.
- BRD §4.2 describes this as large-scale and optional. The owner made it mandatory. This implementation is the personal-scale path. It does not claim a large collection.
- BRD §11 names FAISS, Chroma, or Qdrant. The approved store remains Neon pgvector, in a separate column.
- M0 limited OpenCV to boundary detection, perspective correction, and contrast. Region boxes are an additional local step required by the BRD and this milestone. Transcription preprocessing is unchanged.
- The published `POST /assistant/query` still says `200 Answer`. The approved async `202` plus poll remains. The image is accepted on that path. OpenAPI was not edited.
- The embedding guide allows PNG and JPEG. The frozen page also accepts WebP, so the server converts it locally.

## Not done

- No labeled image-retrieval score. No page image was sent to Gemini. Local synthetic vectors are not a quality claim for `gemini-embedding-2`.
- No Render memory or query-latency measurement, including image upload. The implementation keeps one region in flight, caps a query or crop at about 1 megapixel, and does not load a local vision model.
- No interactive region overlay. The existing page shows coordinates and a source link.
- This work is uncommitted. `main` was not changed.
