# KnowFlow frontend/backend and deployment handoff

## Contract ownership

The frontend uses `/api/v1`. `frontend/src/api/types.ts` defines returned domain DTOs. `frontend/scripts/generate-contract.mjs` derives those schemas with the existing TypeScript compiler API and explicitly defines request schemas, operation semantics and response codes. Its deterministic output is [openapi.json](openapi.json).

Implement against both the operation descriptions and schemas. Regenerate with `npm run contract:generate` and verify with `npm run contract:check` in `frontend/`. TypeScript typing is not server-side validation and does not validate arbitrary runtime payloads. Backend implementations must add request/response contract tests and verify actual model/storage outputs.

## Session and authorization

1. `GET /session` returns `200 {user:null, csrfToken}` for a valid anonymous session, or a User/Admin session. Unavailability is an error, never an anonymous success substitute.
2. Use a host-only `knowflow_session` cookie with HttpOnly, Secure, Path=/ and appropriate SameSite protection. Rotate sessions/CSRF on authentication; never send passwords/tokens to localStorage.
3. Check the browser Origin against the deployed frontend allowlist and validate `X-CSRF-Token` for every mutation, including login/register. Credentialed requests include the cookie. Anonymous sessions need CSRF bootstrap too.
4. `401` invalidates frontend session state. `403` means authenticated but forbidden. `404` may conceal inaccessible IDs. Validate authorization on every endpoint, job, source file and retrieval/history operation. Browser route guards are navigation controls only.
5. Registration must never accept a client-specified Admin role. Provision Admin privately. Enforce email-control checks for registration, email changes and sharing acceptance; a supplied email string is not proof of ownership. Backend-managed verification links can return users to login/Sharing after verification; do not grant a session or share based on an unverified claim.
6. Password changes verify the current password and revoke other sessions; return 204 only after completion. Rate-limit authentication and expensive processing/query requests. No user-facing SSO/2FA/recovery claims are made without an implementation.

## Data conventions

- IDs are opaque strings. Path segments are encoded by the client. Never trust an ID as proof of access.
- Timestamps are ISO 8601 instants; task due dates are calendar `YYYY-MM-DD`. Timeline filters include the browser's IANA timezone; document date filters use `createdAt`. Enforce valid ranges server-side.
- Lists return `{items,total,page,pageSize}` with one-based pages, default 20 and maximum 100. `total` is after filtering and ACL checks. Stable ordering/tie-breakers are specified per operation.
- Return errors as `{error:{code,message,fields?,requestId?}}`, with safe messages and string field messages. Never leak keys, raw provider prompts, traces or inaccessible source text.
- Use 400/422 for validation, 401/403 for auth, 404 for unavailable resources, 409 for conflicts, 413/415 for intake, 429 for rate limits, 5xx for unavailable services. Do not return an HTML error page with HTTP 200.
- `PATCH` returns the canonical persisted DTO. `DELETE` and password update return 204 without a body. Do not report success before persistence.
- Source URLs must be HTTPS or same-origin, authorized and short-lived where appropriate. Return `null` when an artifact is not available. Serve originals safely (`nosniff`, correct Content-Type/Disposition); do not embed untrusted active HTML as application content.

## Intake, media and jobs

`POST /ingestions` is multipart: repeated `files`, `text`, and JSON-string `metadata` containing title/tags/type/meeting association/time plus capture/model preferences. The preference is a hint, not proof of file kind; enforce enabled sources using actual input. Both empty files and blank text are invalid. Browser validation supplements—never replaces—file-signature/size/quota checks, safe document parsing and storage controls.

Capabilities define MIME types, file/batch/text/recording limits, document types/topics, enabled source kinds (`file`, `camera`, `text`, `audio`) and opaque model choices. Advertise only real configured functionality. Recorded audio MIME availability differs by browser; the UI checks recording compatibility or directs the user to upload. Audio becomes an ordinary source artifact; transcript text is reviewed in Document Detail.

A submitted job returns 202 with its stable ID. The UI polls approximately every three seconds and stops on `succeeded`, `failed` or `cancelled`. Return per-item artifacts/errors; do not hide partial batch results. Retry processes failed items only. Cancellation does not erase already completed artifacts.

Intake and assistant POSTs carry an `Idempotency-Key`. Bind keys to actor/operation/request content; replay identical requests, reject mismatches with 409. Preserve replay records long enough to cover timeout/retry. The frontend reuses the key for an unchanged failed attempt; cancelling a browser request cannot guarantee the backend stopped executing it. Do not blindly auto-retry mutations.

## Documents, meetings and tasks

Persist source, processed image, OCR/transcript, metadata and index associations. Text/metadata correction must update compatible retrieval representations without implying that a model was retrained. Store extracted text as text; render it without HTML injection.

Meetings group their owner's artifacts by meeting ID or label/time. Summaries/decisions must be grounded in those artifacts. Task extraction must be idempotent and retain source references; personal task edits/completion/deletion affect only the task owner. Sharing one document does not share its meeting, sibling documents or someone else's tasks.

## Sharing: selected documents only

BRD §14 says “Collaborative use cases (sharing workspaces with classmates or team members).” The owner explicitly chose selected-document permission sharing after this was quoted and clarified. No enterprise tenancy or shared workspace object is introduced.

- Owner: invite by email, view grants, change view/edit, revoke.
- View: read/download and grounded retrieval over that document.
- Edit: view plus title/type/topic/text correction; no reshare/grant management.
- Recipient: list their invitations in `/sharing`, accept/decline through `/invitations/{id}/accept|decline`, then open accepted documents or filter Library to shared.
- Pending grants do not expose document content. Acceptance requires the intended authenticated recipient and a still-live invitation. Normalize email, reject self/duplicate grants and prove identity.
- Revoke immediately for new file access/retrieval/task/source/history responses. Cached answers must be reauthorized/redacted after access changes. Previously downloaded copies cannot be recalled; no such promise is made.

## Assistant and analytics

`POST /assistant/query` is multipart `query`, optional `image`, JSON `context` with conversationId/documentIds. Empty documentIds selects all accessible documents; nonempty IDs restrict the corpus. Return atomically persisted user/assistant messages and stable conversation ID. Insufficient evidence is explicit, not an invitation to fabricate an answer.

Sources carry document ID/title, optional page/excerpt and normalized `[x,y,width,height]` image region. The UI shows these references and routes to the document; PDF source links preserve the cited page. The backend owns real multimodal embeddings, region interpretation, compatible indexes and prompt-injection-resistant retrieval boundaries. No provider is hard-coded in the browser. Conversation lists are paginated.

Analytics return current personal document/task counts, period activity, tagged-document topic counts and a nullable studyMinutes plus studyTimeDefinition. Return null when study time is unmeasured. No hidden tracking or arbitrary “minutes per document” estimation has been added. Real measurement collection/provenance remains a backend/product integration decision, not a fabricated frontend statistic.

## Netlify frontend / Render backend

The checked-in `netlify.toml` sets base `frontend`, build `npm run build`, publish `dist`, Node 22.22.3, security/media headers, a deliberate JSON 503 API fallback and then the SPA rewrite.

When the real Render service is ready, **replace** the existing `/api/*` fallback with its actual HTTPS reverse-proxy destination (do not keep both competing rules):

```toml
[[redirects]]
  from = "/api/*"
  to = "https://YOUR-ACTUAL-SERVICE.onrender.com/api/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

`/api/v1/session` must become `/api/v1/session` at Render, not `/v1/session` or `/api/api/v1/session`. Keep `VITE_API_BASE_URL=/api/v1` for same-origin browser requests. The host placeholder above is documentation, not a configured live service.

Render must trust only the known proxy path/forwarded headers, allow the exact Netlify/custom preview origins you operate, preserve forwarded cookies/CSRF, and emit host-only cookies (no Render-domain cookie on proxied responses). Configure `Cache-Control: no-store, private` for session/private API responses so the CDN cannot cache one user's data for another. Validate real Set-Cookie behavior through the proxy before release. Camera/microphone require HTTPS and permission; embedding policies may impose additional restrictions.

Development: `.env.local` contains `VITE_API_BASE_URL=/api/v1` and `API_PROXY_TARGET=https://actual-service.onrender.com` (or a local backend origin, used only server-side by Vite). `API_PROXY_TARGET` is **not** exposed through Vite's public prefix. An absolute public API base is supported by the client but requires explicit credentialed CORS, exact origins and correct SameSite policy; the same-origin proxy is the intended deployment.

All provider keys, model adapter credentials, database/vector-store access, storage signing keys, email verification configuration and server secrets belong in Render's private configuration. No `VITE_*` secret is safe. Storage/provider/runtime choices remain unselected where the owner has not chosen them.

## Integration acceptance before a production release

With a real service, verify cookie/CSRF rotation and expiry; owner/view/edit/Admin denial matrices; email-control/invitation acceptance; revoked-file and historical-answer access; real supported MIME signatures; partial OCR/transcription failures; processing idempotency/cancellation; model capability availability; source-grounded text/image answers; accurate metrics; error/rate-limit handling; deep-link reloads; CDN privacy and source expiry. Run physical camera/microphone tests and target-browser/manual accessibility checks.

These are external integration acceptance conditions, not an authorization to start backend development or Phase 5. No live Netlify/Render deployment was performed during Phase 4.
