# M5 exit report

Date: 2026-11-11. Scope: complete meeting workflow. This is a local verification record, not a deployment or provider-quality claim.

Authority: BRD §§6.2 and 10.2, `docs/BACKEND_HANDOFF.md` meetings section, and the published `/meetings*` operations. M5 does not change `docs/openapi.json` or `frontend/`.

## What landed

- `GET /api/v1/meetings` lists only the current user's meetings. Search matches the title. Page is at least 1 and page size is 1–100. Order is newest `occurredAt`, then `id`, which is the same stable dated-list tie-break used by the timeline. The published text says "stable occurredAt,id order" and does not say ascending or descending. That direction was not written into OpenAPI.
- `POST /api/v1/meetings` creates an empty personal meeting and returns `201 Meeting`. An empty meeting has `summary: null`, no decisions, no artifacts, and no tasks. Asking it for a summary returns 422 instead of inventing one.
- Explicit create does not collapse two meetings that happen to share a title. Capture grouping is separate: a `meetingId` attaches to that owned meeting, and `meetingTitle` plus `occurredAt` reuses the earliest owned session with the same normalized title and timestamp. Another user's session is never reused.
- `GET /api/v1/meetings/{id}` returns that owner's artifacts, summary, decisions, and tasks. A missing or unauthorized meeting is 404 and the body does not include the title.
- `POST /api/v1/meetings/{id}/summarize` returns `202 Job` and does not call a provider. Polling `GET /jobs/{id}` advances one unit: one summary generation, or one page of task extraction. A second summarize while that job is queued or running returns the same job. Cancel before the first poll saves nothing.
- The summary prompt contains only text from artifacts owned by the meeting owner and attached to that meeting. Excerpt text is untrusted. A decision is saved only when it is a sentence copied from that text. Ungrounded decisions, including instructions found in an artifact, are dropped. If nothing is supported, the summary says so and decisions stay empty.
- A missing or shortened artifact is called partial in the summary. A failed generation leaves an explicit failure sentence when there was no current summary, and the job remains retryable. A later correction changes the evidence hash; the meeting then shows that the summary is out of date and hides the old decisions until it is generated again.
- Task extraction reuses M3 fingerprints, tombstones, and `user_edited`. Re-summary adds new extracted tasks, removes stale pending extracted tasks, and does not recreate a deleted task or overwrite a completed edit.
- Sharing one artifact does not share the meeting. The grantee gets 404 for the meeting, does not see `meetingId` on the document or timeline event, does not see sibling artifacts, and does not see the owner's tasks.

## Checks

`PYTHONPATH=/home/user/KnowFlow/backend /tmp/knowflow-m1/bin/pytest -q backend/tests` → **43 passed, 1 warning in 23.21s**.

The warning is Starlette's `httpx`/`httpx2` TestClient notice. The run includes M1–M5. Tests inject a fake transcriber, embedder, and generator. No test calls Gemini, Groq, R2, or Neon.

Covered locally:

- an empty meeting stays empty and cannot be summarized into invented decisions
- the same label and time groups two owned captures; a meeting id attaches a later capture; another user's meeting stays hidden
- a whiteboard image plus a text note, transcribed by a fake, become one meeting with both artifacts, a copied decision, and a deduplicated action
- the summary call happens on poll, not on the 202 response, and a repeated summarize does not start a second job
- correcting an artifact marks the summary stale; re-summary keeps the edited task, adds the new action, and does not restore a deleted action
- a view grant on one artifact exposes neither the meeting record, the sibling text, nor the owner's task
- a timed-out summary is understandable and retryable
- "What did we decide?" over the meeting's document cites that artifact and not another meeting's text

## Not done

- No Render, Neon, Cloudflare, Gemini, or Groq call. The screenshot path was not measured against a live vision provider.
- Migration `005_m5_meetings` was applied only to temporary SQLite test databases.
- Audio transcripts are still M6. They will enter this same meeting path when that milestone is authorized; M5 does not advertise transcription.
- This work is uncommitted. `main` was not changed.
