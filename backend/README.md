# KnowFlow API — Milestone M1

Single FastAPI process for a Render free web service. Neon PostgreSQL is the intended database. This milestone implements identity, sessions, settings, capabilities, and Admin only. It does not call Gemini or Groq and does not accept uploads.

## Run

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
```

Render start command:

```bash
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Use one worker. Do not attach a disk. Set `DATABASE_URL` to the Neon connection string with `sslmode=require`.

## Environment

See `.env.example`. `KNOWFLOW_COOKIE_SECURE` must stay `true` on Render. `KNOWFLOW_ALLOWED_ORIGINS` is the exact browser origin list, not the Render host. Admin is assigned only by `python -m app.cli promote-admin you@example.com` or by listing an already verified address in `KNOWFLOW_ADMIN_EMAILS`. Registration cannot choose a role.

## Email verification

Local and free staging do not send mail. Registration returns `201` with a `Session` whose `user` is null. It does not sign the browser in. The one-time token is written to stdout:

```text
KNOWFLOW_EMAIL_VERIFICATION purpose=registration email=you@example.com token=... expires_at=...
```

Confirm with the anonymous CSRF session:

```bash
curl -s -c cookies.txt -H 'Origin: http://localhost:5173' http://localhost:8000/api/v1/session
curl -s -b cookies.txt -c cookies.txt -H 'Origin: http://localhost:5173' \
  -H "X-CSRF-Token: TOKEN_FROM_SESSION" -H 'Content-Type: application/json' \
  -d '{"token":"LOG_TOKEN","password":"the-signup-password"}' \
  http://localhost:8000/api/v1/auth/email-verifications/confirm
```

Confirmation does not sign the browser in. Sign in after it succeeds. These log lines are activation secrets; do not publish them.

## Contract

Published operations return the DTOs in `docs/openapi.json`. Registration's success body is `Session` with `user: null`, so the published Login page does not navigate into the app. It also does not show a verification message, because that message cannot be added to the frozen `Session` object. `POST /auth/email-verifications/confirm` is the redemption path required by the handoff. It is not in the frozen frontend operation list. Confirmation returns an anonymous `Session` and does not sign the browser in.

## Tests

```bash
pytest
```
