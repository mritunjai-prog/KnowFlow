# M9 exit report

Date: 2026-11-11. Scope: measured personal analytics and the explicit study timer. This is a local verification record, not a deployment or attention-measurement claim.

Authority: BRD §14 and §§8.4 and 13, the M9 roadmap exit gate, `docs/BACKEND_HANDOFF.md` analytics rules, the published `Analytics` shape, and D5 in `docs/M0_DECISION_RECORD.md`. `docs/openapi.json` and `frontend/` were not edited.

## What landed

- `GET /api/v1/analytics?days=7|30|90` returns the published `Analytics` object from persisted rows. `documentCount` is the caller's current owned documents, including documents outside the period. It does not include documents shared with the caller. Pending and completed task counts are the caller's current tasks whose source document is still readable. They match the task list. A revoked source drops out of both counts.
- Activity counts owned captures by `createdAt`, split on the requested IANA timezone day. It does not use the meeting's historical time. A day with neither a capture nor a counted completion is omitted, so an empty period returns `activity: []`.
- A completion counts once. The server writes a status event only when pending becomes completed, or completed becomes pending. Sending completed again does not write another event and does not move the timestamp. Reopen drops the task from the completion count. A later complete writes one new event, and only that latest event is counted. The same task cannot add a completion to two days.
- Topic coverage counts current accessible tagged documents. A document with two tags counts in both. It is not filtered by the period, and it is not a mastery score. A shared document counts for the recipient only after acceptance. A sibling document is not included. Admin does not see another user's topics.
- `timezone` is an optional IANA name, the same query name Timeline already uses. Omitted, it is UTC. The published Dashboard does not send it yet, so a connected Dashboard gets UTC days until the contract sync adds the query. Invalid names and days other than 7, 30, and 90 are rejected.
- Study time is not inferred. Opening a document does not create minutes. `studyMinutes` is null when the period has no confirmed seconds, including a timer that was started and then abandoned before any second was confirmed. Once at least one confirmed second falls in the period, minutes are that overlap divided by 60 and rounded once to one decimal, half up. A measured value can be 0.0. The definition string says which timezone was used and that this is not attention or mastery.
- The timer is Start, Pause, Resume, and Stop. The client cannot submit elapsed time, a start time, or a duration. One open session per user includes a paused session. A second start returns 409 `STUDY_SESSION_OPEN`. Heartbeats and the other mutations require `Idempotency-Key`. A replay returns the stored result and does not add time. A different payload with the same key returns 409.
- The server credits time only through the receipt of a valid heartbeat, pause, or stop. The lease is 90 seconds from the last confirmation. If the next request is later, the session pauses at the last confirmed time with `connection_lost`. The gap is not credited, and a late heartbeat does not resume it. Resume starts a new interval and does not fill the pause. Stop of a paused session adds nothing.
- Confirmed intervals are stored in UTC and split on the requested timezone day. An interval that crosses the period boundary contributes only the overlap. An already issued file URL is unrelated; this milestone does not change the 60-second file rule.
- A four-hour wall-clock cap ends an open session at its last confirmed time with `stop_reason=safety_cap`. It does not credit forward to the cap. The closed M0 record states the 90-second lease and does not repeat this cap. The cap is the proposal's bound, recorded here so a client that keeps heartbeating cannot record an unbounded session.
- The owner can list sessions and delete one with `If-Match` set to its revision. Deletion removes it from the aggregates. Another user receives 404. If the associated document is no longer readable, the response keeps no title and returns `documentId: null`. The measured time remains the caller's.

## Contract delta

These are not in `docs/openapi.json` or `frontend/src/api/types.ts`. They are recorded beside the M1 verification gap and the M4 assistant gap in `PROJECT_MEMORY.md` and `docs/M1_EXIT_REPORT.md`.

| Method and path | Result |
|---|---|
| `GET /api/v1/study-sessions/current` | 200 `{session, serverTime}`. Reconciles a missed lease. `session` is null when nothing is open. |
| `POST /api/v1/study-sessions` | 201 state. Optional `{documentId}`. `Idempotency-Key` required. Another open session is 409 `STUDY_SESSION_OPEN`. |
| `POST /api/v1/study-sessions/{id}/heartbeat` | 200 state. Body `{revision}`. Credits only through the server receipt while the lease is valid. A late heartbeat stays paused. |
| `POST /api/v1/study-sessions/{id}/pause` | 200 state. Body `{revision}`. |
| `POST /api/v1/study-sessions/{id}/resume` | 200 state. Body `{revision}`. Does not credit the paused gap. |
| `POST /api/v1/study-sessions/{id}/stop` | 200 state. Body `{revision}`. |
| `GET /api/v1/study-sessions` | Paginated owned history. Optional `from`, `to`, and `timezone`. |
| `DELETE /api/v1/study-sessions/{id}` | 204. `If-Match` must be the revision. |

`GET /api/v1/analytics` accepts optional `timezone`. The response is still the published `Analytics` object. The proposal's extra `studyTime` object was not added, because the frozen schema rejects unknown fields. `studyMinutes` and `studyTimeDefinition` carry the measurement.

The browser allow-list now includes `Idempotency-Key` and `If-Match`. That does not change a published schema. The published ingest and assistant calls already send `Idempotency-Key`.

## Checks

`PYTHONPATH=/home/user/KnowFlow/backend /tmp/knowflow-m1/bin/pytest -q backend/tests` → **61 passed, 1 warning in 57.53s**.

The warning is Starlette's `httpx`/`httpx2` TestClient notice. The run includes M1–M9. No Gemini, Groq, R2, or Neon call.

Covered locally, and recomputed from stored rows rather than from the aggregator function:

- an empty period is zeros, an empty activity list, and `studyMinutes: null`; repeated document reads do not create minutes
- 7, 30, and 90-day windows, including a capture 10, 40, and 100 local days ago
- the same UTC instant falls on different dates in Asia/Kolkata and America/Los_Angeles
- two completes, a reopen, and another complete produce one completion on the latest day
- a retried ingestion does not create a second document
- a recipient's owned count stays 0; topic coverage includes only the accepted document, not its sibling; revoke removes the topic and the recipient's task; an outsider and Admin see neither
- a 90-second confirmed interval that crosses the period start contributes only the overlap
- the same heartbeat key does not add the next interval; a 10-minute pause is not credited
- a 91-second silence pauses at zero and does not resume on the next heartbeat
- deleting the crossed-boundary session removes its minutes
- a heartbeat after the four-hour cap completes at the last confirmed time and does not add the overshoot
- a second tab cannot open another session
- a revoked document's title is absent from study history

## Conflicts

- BRD §14 called analytics future work. The owner already made it mandatory. No workspace object was added.
- The proposal spelled the query `timeZone`. Timeline and this route use `timezone`.
- The proposal added a `studyTime` object inside `Analytics`. The frozen schema forbids extra fields, and the frontend was not authorized to change. The existing nullable minutes and definition are the response.
- The published OpenAPI parameter says `days` is any integer of at least 1. The operation description says 7, 30, or 90. The server accepts only those three.
- The M0 decision record requires the 90-second lease and does not repeat the proposal's four-hour cap. The cap is implemented and named above. It does not credit unconfirmed time.
- The published Dashboard will not send `timezone` until a later contract sync. Until then its days are UTC. That is the recorded legacy default, not a claim that the browser zone was used.

## Not done

- No study-timer controls were added to the Dashboard. The collection API is here; the screen still only reads `/analytics`.
- No physical second browser. The second tab is another test client on the same local app.
- No Render, Neon, Cloudflare, Gemini, or Groq call. Latency and memory were not measured.
- This work is uncommitted. `main` was not changed.
