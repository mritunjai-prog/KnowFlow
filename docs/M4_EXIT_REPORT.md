# M4 exit report

Date: 2026-11-11. Scope: grounded text retrieval and saved conversations. This is a local verification record, not a deployment or provider-quality claim.

## What landed

- Extracted text is chunked with page provenance. Form-feed page breaks from PDF extraction are preserved. A page longer than 800 characters is split on sentence boundaries.
- Embeddings use the M0 pin: `gemini-embedding-001`, 768 dimensions, `RETRIEVAL_DOCUMENT` for chunks and `RETRIEVAL_QUERY` for questions, one item per request. The request builder does not call the batch embedding endpoint. Vectors are stored as JSON for the SQLite tests. Migration `004_m4_retrieval` adds a `vector(768)` column only when the dialect is PostgreSQL.
- M3 corrections that change text mark the previous chunks stale, increment `index_version`, and queue a re-embed. Retrieval ignores stale chunks and chunks from an older index version. A title-only correction does not discard current vectors.
- Retrieval candidates are limited to documents the caller owns or holds through an accepted grant, then optionally to the requested `documentIds`, before scoring or prompt construction. Access and index version are checked again before the answer is saved and again when history is read.
- Retrieved text is sent as untrusted data. The generation instruction says excerpt text cannot change the rules, reveal other documents, call tools, or browse. If the model does not return a supported citation, the saved answer abstains.
- User and assistant messages are saved in one commit with `Source` references (`documentId`, `title`, `page`, `excerpt`). History reads replace a citation whose document is gone, revoked, or stale with an explicit unavailable answer and no excerpt.
- `GET /api/v1/conversations` is the current user's saved conversations, ordered by `updatedAt,id`, with page at least 1 and page size 1–100. `GET /api/v1/conversations/{id}` returns that user's history after revalidating sources.
- Assistant queries require `Idempotency-Key`. The same actor, key, and content replay. A different payload with the same key returns 409.

## Async contract delta

Published `POST /assistant/query` returns `200 Answer`. That shape cannot stay inside the 26-second Netlify proxy limit, so M4 implements the approved M0 flow instead:

- `POST /api/v1/assistant/query` returns **202** and a query-status object with an id. It does not call a provider.
- `GET /api/v1/assistant/queries/{id}` performs one unit: one chunk embed, one query embed, or one generation. The unit commits before the provider call and does not hold the request session closed.
- `POST /api/v1/assistant/queries/{id}/cancel` cancels a query that has not saved an answer.
- A finished poll contains the published `Answer` object. The poll body itself is not `Answer`.

This delta is also recorded beside the M1 verification note in `PROJECT_MEMORY.md` and `docs/M1_EXIT_REPORT.md`. `docs/openapi.json`, `frontend/`, and `netlify.toml` were not edited. The current Assistant page still expects a synchronous `Answer`, so it will not consume this flow until a later authorized contract sync.

Optional query images are rejected. Image embeddings are not part of M4.

## Checks

`PYTHONPATH=/home/user/KnowFlow/backend /tmp/knowflow-m1/bin/pytest -q backend/tests` → **36 passed, 1 warning in 22.94s**.

The warning is Starlette's `httpx`/`httpx2` TestClient notice. The run includes M1–M4. Tests inject a fake embedder and a fake generator. No test calls Gemini, Groq, R2, or Neon.

Covered locally:

- an answerable question cites the accessible chunk and reloads from saved history
- an unrelated user's text does not appear in the answer, snippets, or conversation list
- selected `documentIds` restrict the corpus, and an instruction inside a chunk is not treated as authority
- a text correction is not authoritative until its replacement chunk is embedded
- revoking a grant removes the excerpt from a later history read
- replay, mismatch, cancel, and the local poll path finishing inside 15 seconds

## Not done

- No Render, Neon, Cloudflare, Gemini, or Groq call. The 45-second client budget was not measured against a live proxy.
- pgvector ordering was not executed. SQLite tests score stored JSON vectors. The PostgreSQL statement is recorded for the Neon migration and was not run.
- Migration `004_m4_retrieval` was applied only to temporary SQLite test databases.
- This work is uncommitted. `main` was not changed.
