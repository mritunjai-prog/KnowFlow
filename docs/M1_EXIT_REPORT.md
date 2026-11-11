# M1 exit report — Trusted Service Foundation

Date: 2026-11-11. Scope is the authorized M1 boundary only. No deployment, provider call, frontend edit, contract edit, commit, or `main` merge was made.

## Result

The foundation is implemented in `backend/` and the isolated checks below passed. It is not deployed, and it has not been run against Neon.

`PYTHONPATH=backend /tmp/knowflow-m1/bin/pytest -q` from `backend/`:

**14 passed, 1 warning in 4.71s.**

The warning is Starlette's deprecation notice that `httpx` with `starlette.testclient` should be replaced by `httpx2`. It is not a product failure. The temporary virtualenv used pinned versions from `backend/requirements.txt`; those versions installed successfully. Tests used a temporary SQLite database, not Neon.

## What was verified

| Exit check | Result |
| --- | --- |
| Register, confirm from the stdout token, then login | Passed. Registration returns `201` and a `Session` with `user: null`. |
| Login, logout, password change, and profile read | Passed. Password change returns `204` with an empty body and revokes a different live session. The current session remains usable. |
| Account survives a new process against the same database | Passed. A second application instance logged in and read the saved profile. |
| Expired session becomes anonymous | Passed. |
| Missing or stale CSRF, foreign Origin, client-supplied Admin role | Passed. A foreign Origin returns `403 ORIGIN_REJECTED`. A missing CSRF token returns `403 CSRF_FAILED`. `role` on registration returns `422`. |
| Non-Admin call to Admin routes | Passed with `403 FORBIDDEN`. An anonymous call returns `401`. |
| Capabilities contain no secrets and advertise no processing | Passed. MIME types and capture sources are empty. Models are listed unavailable. `multimodal` and `transcription` are false. |
| Admin status is aggregate only | Passed. Counts and storage bytes are returned. Another user's title, email, and password are absent. |
| Alembic upgrade, downgrade, upgrade, then row copy into a new database | Passed on SQLite. This is not a Neon backup restore. |
| Verification token on stdout | Passed. `capsys` saw `KNOWFLOW_EMAIL_VERIFICATION purpose=registration ... token=...`. A GET to the confirmation path returns `405` and does not echo the token. |

Cookie checks passed for `knowflow_session`: `HttpOnly`, `Secure` when configured, `SameSite=lax`, `Path=/`, and no `Domain` attribute.

No application module calls Gemini, Groq, or another provider. Catalog model ids are advertised with `available: false`.

## Contract reconciliation

`docs/openapi.json` says `POST /auth/register` succeeds with `201` and a `Session`. `docs/BACKEND_HANDOFF.md` says an unverified email must not receive an authenticated session or a share. Those requirements are both honored by returning the published success shape with `user: null` and rotating to a new anonymous cookie. The account is stored unverified. Login before confirmation returns `403 EMAIL_VERIFICATION_REQUIRED` and does not create a user session. A duplicate registration of a verified address returns the same anonymous `Session` and does not print a new token.

`POST /auth/email-verifications/confirm` is not in the frozen operation list. It is the redemption path required by the handoff, because the frozen contract has no verification-completion operation. Its success body is an existing `Session` DTO with `user: null`. It does not sign the browser in. This route is an explicit contract gap, not a silent replacement for `201 Session`.

`PATCH /settings` returns the canonical persisted `Settings` object. A requested email change is not applied until confirmation, so the returned email remains the current address. The token is printed to stdout. The frozen `Settings` object has no pending-email field, so the published Settings page can show “Settings saved” while the address is unchanged. That is a frontend integration gap. The frontend was not edited.

The published Login page calls `auth.accept` only when registration returns a `Session`. With `user: null`, it does not navigate into the app and it does not show the log instruction, because a successful `Session` has no message field. The owner must read the server stdout until a later, separately authorized contract and Login change adds a pending-verification state.

M4 adds a second recorded gap, not a published-contract edit. `docs/openapi.json` says `POST /assistant/query` returns `200 Answer`. The approved M0 decision is a short `202` with a query id, then poll and cancel, because the Netlify proxy times out at 26 seconds. M4 implements that approved flow. `GET /assistant/queries/{id}` and `POST /assistant/queries/{id}/cancel` are not in the frozen operation list. Their poll body is not the published `Answer` object; a finished poll carries `Answer` inside a query-status object. `docs/openapi.json` and `frontend/` were not edited.

M9 adds a third recorded gap, not a published-contract edit. The study-session routes below are not in the frozen operation list. `GET /analytics` also accepts an optional IANA `timezone` query. The published `Analytics` object is unchanged: no `studyTime` object was added, because that object is not in the frozen schema. The route list and counting rules are in `docs/M9_EXIT_REPORT.md`. `docs/openapi.json` and `frontend/` were not edited.

## Not done

- No Render, Neon, Cloudflare, Gemini, or Groq call.
- No upload, OpenCV, transcription, or assistant route.
- No real email delivery. Tokens are stdout-only, as decided for local and free staging.
- The restore exercise copied one user row between two SQLite files after migrations. It did not restore a Neon backup.
- Local git HEAD is `2583785840167a041c6f3b4a6ec77fe8061132d6`. `origin/arena/d9bd44f3-knowflow` remains `f9258311e9a2842ed09219db8b4332911783d57f`. This M1 tree is uncommitted. `main` was not changed.
