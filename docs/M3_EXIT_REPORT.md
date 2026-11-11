# M3 exit report — classification, topics, and tasks

Date checked: 2026-11-10. No deployment, live Gemini call, live R2 call, or `main` merge was made. The frontend and `docs/openapi.json` were not edited.

## Verification

```text
cd backend
PYTHONPATH=/home/user/KnowFlow/backend /tmp/knowflow-m1/bin/pytest -q
28 passed, 1 warning in 15.76s
```

The warning is Starlette's existing TestClient notice. The run includes the M1 and M2 suites. SQLite was the test database. Classification and action detection in the API tests used either the local model or an injected fake. No test called Gemini or Cloudflare.

## Measured held-out quality

The local model is `local-tfidf-logistic-v1`: binary unigram TF-IDF logistic regression for document type and topics, nearest-centroid topic clustering, and a separate bigram logistic model for action sentences. Weights and the topic threshold were fit only on the training split. The held-out rows are frozen, synthetic, and non-sensitive. They were not used to choose weights or the threshold.

| Measure | Result |
| --- | --- |
| Document-type accuracy | 1.0 on 10 held-out documents |
| Document-type macro F1 | 1.0 |
| Topic precision / recall / F1 | 1.0 / 0.9 / 0.947 |
| Topic centroid clustering F1 | 0.947 |
| Action precision / recall / F1 | 1.0 / 1.0 / 1.0 on 12 held-out sentences (6 positive, 6 negative) |
| Train/held-out id overlap | 0 |

The one topic miss is `held-doc-other-databases`: the type `other` was correct, and the `databases` topic was not assigned. A secondary priority head scored 4 of 6 held-out positive sentences. That head is not the action-detection gate.

These numbers are not a claim about real student notes, handwriting, or the 40 owner-labeled passages in the M0 baseline. That corpus has not been collected. The perfect type and action scores come from a small synthetic split that shares domain words with training. A zero-weight model does not produce the same type scores, so the result is not a hardcoded label table.

## Gate

| Exit condition | Result |
| --- | --- |
| Classification and topics | A durable job step runs the model after extraction and persists the predicted type and topics when the user did not supply them. User-supplied type and tags are kept. |
| Action precision/recall | Measured on the frozen held-out sentences above. Extracted tasks keep the source sentence, page, and an explicit calendar date when one is present. |
| Retry does not duplicate or overwrite | Retrying a failed item reuses the document and fingerprint. An edited description, priority, and completed status survived. A deleted extracted task was not recreated. |
| Sources and due dates survive reload | After a new process, the task still had its document id, meeting id, and `2026-12-01` due date. |
| Revoked source | A view grant allowed a personal task. After the grant was revoked, the task list, task patch, and document read no longer disclosed the source. Sharing the document did not expose the owner's tasks. |
| Correction without retraining | `PATCH /documents/{id}` updated title, type, tags, text, and the timeline event. `index_state` became `stale`, `index_version` increased, and `retrieval_invalidated_at` was set. The classifier id and stored prediction were unchanged, and the adapter was not called again. |

## What is now real

- `GET/POST/PATCH/DELETE /api/v1/tasks` support completion, reopening, priorities, `YYYY-MM-DD` due dates, and owner-scoped search by description, status, and source document.
- Classification and action detection are separate stored job steps. Each poll does one step and releases the database session before the model call.
- The Gemini Flash adapter is present, pinned to `gemini-3.8-flash`, temperature 0, JSON output, and no tools or search. It is used only when an API key is configured. Tests do not configure one.
- Capabilities advertise the topic labels the local model can assign. Transcription and multimodal remain false.

## Honest boundaries

- No embeddings, semantic search, meeting summaries, audio transcription, sharing-management routes, or analytics were added.
- A correction marks retrieval stale. It does not rebuild an index and does not retrain a model.
- Relative dates such as "tomorrow" are not inferred. Only an explicit calendar date in the source sentence is stored.
- The Gemini path was not executed against Google.
