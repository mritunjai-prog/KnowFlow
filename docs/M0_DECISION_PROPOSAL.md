# M0 — Decision proposal and evaluation-baseline specification

**Date:** 15 October 2026  
**Status:** Submitted for explicit approval; no decision below is adopted yet.  
**Authority:** BRD §§7–14, owner clarifications, approved-in-principle Phase 5 roadmap, and the current frontend/contracts at `1df6b73`.

The owner authorized recommendations only: **no backend implementation, package installation or edits to existing contracts**. This is a separate proposal, not a replacement OpenAPI specification. No benchmark, deployment, purchase or provider-account configuration was performed. M0 cannot be marked accepted until the owner resolves the choices and the later authorized feasibility checks pass.

## Executive recommendation

| Decision | Recommended direction | Explicit approval needed |
|---|---|---|
| D1 | Python/FastAPI modular API, SQLAlchemy/Alembic, managed PostgreSQL; one codebase with separate API/worker processes | Backend stack and eventual dependency categories |
| D2 | Private Cloudflare R2 object storage; PostgreSQL **pgvector** for text/image indexes; PostgreSQL-backed durable jobs, no Redis initially | pgvector is an explicit addition to the BRD's indicative examples; external object-storage provider |
| D3 | Hybrid: OpenCV/open-source OCR and embeddings on the worker; OpenAI API as the first candidate for generation and transcription, behind replaceable adapters | External processing/privacy policy and candidate models; no provider is already selected |
| D4 | Application-owned cookie sessions, verified email before usable login, Resend transactional email candidate, privately provisioned Admin | Pending-verification and email-change contract/UX changes |
| D5 | Explicit, user-controlled study sessions, server-confirmed elapsed intervals, no passive behavioral tracking | Study-session APIs/UI and analytics provenance/timezone additions |
| D6 | Paid always-on Render services; test a low-cost resource profile before committing to a larger one; bounded asynchronous processing | Budget, workload/device/quality targets, async assistant and upload transport changes |

All Admin, transcription, multimodal RAG, selected-document sharing and analytics requirements remain mandatory. Hardware limits constrain individual workloads, not whether a feature is delivered.

## D1 — Backend framework and relational database

### Recommendation

Use **FastAPI + Pydantic runtime validation + SQLAlchemy + Alembic + managed PostgreSQL**. Prefer a mature supported Python minor, provisionally Python 3.12, subject to the selected ML wheels' compatibility check before version pinning. Package versions are deliberately not fabricated or installed here.

Build one modular application: identity, documents/artifacts, processing, retrieval, meetings/tasks, sharing, analytics and Admin. Run the same codebase as a thin HTTP API and a separate durable worker. Use containerized deployment later so system tools such as OpenCV/Tesseract/audio decoding have reproducible versions. Do not create one microservice per module.

- Keep React and browser networking unchanged except explicitly approved integration states.
- PostgreSQL owns identity, sessions, ownership/grants, jobs, idempotency records, metadata, corrections, conversations and measured intervals. Do not store uploaded binaries in database rows.
- Keep authentication server-side: opaque session identifiers, stored session hashes, HttpOnly/Secure/host-only cookie, SameSite=Lax, CSRF and exact Origin checks. No browser JWT/localStorage migration.
- Use a migration owner and least-privilege runtime database role. Scope every query by actor/permissions; RLS may be additional defense later, not a substitute for service-level checks.
- Keep API, worker and PostgreSQL in one Render region, using the internal database URL. Render recommends same-region services for private-network access and lower latency. [1](https://render.com/docs/postgresql-creating-connecting)

### Trade-offs

| Alternative | Advantage | Why not the first choice here |
|---|---|---|
| Django | Integrated ORM/auth/admin conventions | Sound alternative, but the existing React Admin and explicit API contract reduce the value of a second built-in UI. FastAPI keeps the API/CV integration direct. |
| Node.js API plus Python processing | Shared language with the frontend | Adds a language/service boundary for a project whose difficult work is Python CV/ML. |
| MySQL | Valid BRD relational option | PostgreSQL can also hold the proposed vectors and durable job state, reducing operational components. |
| SQLite in a service directory | Minimal local setup | Not the proposed shared production database for separate API/worker instances and restart-safe deployment. |

**Cost of the recommendation:** FastAPI does not supply the entire identity lifecycle. Password policy, verification, sessions, rate limits and tests must be implemented deliberately. Recommend Argon2id password hashing, with parameters benchmarked against the small API instance and bounded concurrent password checks.

**BRD fit:** §§7.8, 8.3, 9 and 11. No frontend runtime library is added by this proposal.

## D2 — Artifacts, vector indexing and jobs

### Artifacts: private R2, not a shared Render disk

Recommend **Cloudflare R2 Standard**, accessed through an S3-compatible storage adapter. Use private buckets, opaque immutable object keys and database ownership records. Preserve originals, processed images, transcripts and thumbnails. Encrypt transport, restrict service credentials, and keep tokens/keys out of the frontend.

Render disks cannot be mounted by both the API and worker; each disk is restricted to one service instance and prevents horizontal scaling and zero-downtime deployment of that instance. That makes one disk a poor shared-artifact design. [Render disk limitations](https://render.com/docs/disks#disk-limitations-and-considerations)

R2 lists Standard storage at $0.015/GB-month, request charges and a free allowance; R2 itself does not charge egress. **Render/Netlify traffic can still cost money**, so R2 is not a promise of free end-to-end delivery. [1](https://developers.cloudflare.com/r2/pricing/)

**Alternative:** AWS S3 is suitable if explicit regional placement or an existing AWS account matters more. R2 introduces another vendor; residency requirements must be approved rather than inferred from the user's location. A local filesystem adapter is useful for development, not the production persistence choice.

### File authorization and transfer

- For reads, recommend a **revocable authenticated file gateway**, checking the current session/grant on every new file, thumbnail and range request. Do not redirect a shared-file read to an independently valid storage URL and call it immediately revocable.
- Use `private, no-store`, safe Content-Type/Disposition, `nosniff` and safe inline media types. Existing downloaded/displayed bytes cannot be recalled; in-flight bytes already authorized are not retroactively erased.
- For large uploads, propose scoped presigned **write-only** uploads into quarantine, followed by authenticated completion/validation. A signed upload grant never authorizes a read or makes the artifact queryable.
- Bind each upload to actor, opaque key, expected type/size and expiry. Reserve quota, inspect actual size/signature/checksum, validate before ingestion, and seal an immutable version so reusing an unexpired write URL cannot alter an accepted source. Clean orphaned multipart/quarantine data, provisionally after 24 hours. Do not assume a signed PUT alone enforces every byte limit.
- Large downloads/media ranges also need real proxy-transfer testing. Prefer bounded range/chunk delivery through the gateway; if native PDF/audio clients or slow links cannot meet the proxy envelope, agree a revocable direct-gateway transport before release. Do not silently fall back to non-revocable public links.

### Vectors: pgvector instead of another datastore

Recommend **pgvector in the same PostgreSQL database**. Render explicitly supports the extension. [1](https://render.com/docs/postgresql-extensions)

**BRD clarification for approval:** §§9/11 name FAISS, Chroma and Qdrant as indicative options. pgvector is not named. This proposal deliberately adds it because a small personal application benefits from one transaction/backup/permission boundary. If you want to stay strictly within the named list, **Qdrant** is my alternative, with separate hosting and consistency work.

- Separate text and image embedding spaces/tables or versioned indexes. Never compare text-embedding vectors with unrelated image-model vectors.
- Each indexed item keeps document/version/model/preprocessing/page/region provenance. Corrections invalidate stale evidence until compatible indexing completes.
- Combine PostgreSQL lexical search with vector retrieval. Start with a measured exact-search baseline; use HNSW where it improves latency without losing filtered recall. Benchmark authorization-filtered nearest-neighbor retrieval, not only unfiltered demos.
- Ownership/grants are authoritative in PostgreSQL. Restrict candidates to accessible current versions and recheck evidence before provider calls, final responses and history reads. Approximate-index filtering must not become an authorization shortcut.

**Trade-offs:** pgvector shares CPU/RAM with ordinary queries and jobs. Qdrant gives more isolation and specialized vector operations but introduces another persistent service and stale-ACL/index synchronization risks. FAISS is useful for a local benchmark but requires additional serving, persistence and filtering machinery; embedded Chroma would face the API/worker shared-filesystem problem unless deployed as another service.

### Jobs: PostgreSQL-backed worker first

Recommend a small durable job table with transactional enqueue, leases/heartbeats, bounded attempts and item-level checkpoints. Worker claims use row locking/`SKIP LOCKED`; external work happens outside long database transactions. Use a fencing/lease generation so a resumed stale worker cannot commit after another worker took ownership. Design for **at-least-once execution with idempotent effects**, not an unsupported exactly-once claim.

Keep interactive queries ahead of bulk work without starving ingestion; split page/region work into bounded units. Start with one CPU-heavy task at a time and up to two bounded provider I/O operations. Preserve the existing job API semantics.

**Trade-off:** avoiding Redis saves a service, but the queue is still real engineering: crash recovery, retry/backoff, cancellation, fairness and transactional commits need tests. Celery plus a durable broker is the alternative if routing/retry complexity outgrows this small workload—not an automatic initial dependency.

## D3 — Models and privacy policy

### Recommendation: hybrid processing with explicit external-data consent

Keep source storage, preprocessing, OCR, embeddings, retrieval and classification inside the controlled backend deployment. Use hosted generation/transcription to avoid assuming a small CPU worker can serve a capable LLM in interactive time. “Local model” below means **on our Render worker**, not offline on the user's device.

| Function | First evaluation candidate | Trade-off / gate |
|---|---|---|
| Printed/scanned OCR | OpenCV preprocessing + Tesseract English | Lightweight open-source baseline; not evidence that handwriting is solved |
| Handwritten OCR | `microsoft/trocr-small-handwritten` on segmented lines | Explicit handwriting candidate; its documented input is single text-line images, so page/line segmentation must also be evaluated. [Model card](https://huggingface.co/microsoft/trocr-small-handwritten) |
| Text embeddings | `sentence-transformers/all-MiniLM-L6-v2` | Small 384-dimensional baseline; document text beyond 256 word pieces is truncated by default. Propose ~200-word-piece chunks with overlap and preserved page/region boundaries, not blind 1,000-token chunks. [Model card](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) |
| Image/text image-space embeddings | `google/siglip-base-patch16-224` | Actual image-text retrieval candidate; 224px image processing/short text inputs are not sufficient evidence of fine-grained chart or handwriting understanding. Evaluate page crops plus OCR, not only whole-page resizing. [Model card](https://huggingface.co/google/siglip-base-patch16-224) |
| Document classification | TF-IDF + logistic regression trained on the approved labels | Interpretable, CPU-friendly real ML baseline; needs labeled data. Escalate only if held-out results fail. |
| Topics | MiniLM embeddings + clustering, with human-readable labels and correction | Avoid treating cluster IDs as meaningful topics; evaluate label relevance. |
| Generation, decisions, action extraction | OpenAI API `gpt-5.4-mini`, initially low/no reasoning, bounded structured outputs | First hosted candidate, not a committed vendor. Its documented input includes text/images. Pin the validated snapshot before release; test groundedness and latency on this corpus. [1](https://developers.openai.com/api/docs/models/gpt-5.4-mini) |
| Transcription | OpenAI API `gpt-4o-mini-transcribe` | Hosted candidate; chunk long recordings with time offsets/overlap and validate no omitted/duplicated transcript segments. Snapshot, codec, duration and request limits must be checked before implementation. [1](https://platform.openai.com/docs/models/gpt-4o-mini-transcribe) |

Use a custom, small retrieval/generation pipeline first, rather than adding LangChain by default. Combine text-space and image-space rankings with rank fusion; never average incomparable raw similarity scores. Send the final authorized text/image evidence to the generator and persist source provenance.

**These are benchmark candidates, not accuracy promises.** Model-card/license/weight-redistribution review and resource profiling are approval conditions. Do not download models or install ML packages in this step. Pin model revision, tokenizer/preprocessing, dimensions and distance metric after the authorized trial. Swapping an embedding model requires a new index version/rebuild.

### Explicit privacy terms to approve

1. Hosted generation receives the question, relevant authorized excerpts, limited conversation context and relevant images/crops—not an entire uploaded library. Task/meeting extraction sends the necessary content too. Hosted transcription necessarily receives recording segments; this is not merely sending metadata.
2. Recommend OpenAI API **Responses with `store:false`**, no hosted conversation/vector-store/file-search product, and no tool execution based on retrieved instructions. Our database owns conversation history. `store:false` is **not** a zero-retention guarantee.
3. OpenAI's current documentation says API endpoint content is not used for training by default, but generation abuse-monitoring logs can contain content and normally remain up to 30 days, with exceptions. Endpoint policies differ; zero-retention eligibility must not be assumed. [1](https://developers.openai.com/api/docs/guides/your-data)
4. User-facing notice before submitting recordings/documents for external AI; record consent to the deployment policy. Shared-document processing must respect the owner's policy too. If per-document opt-outs are desired, define their metadata/UI explicitly rather than silently ignoring them.
5. Application logs contain request/job IDs, timing, safe error codes and usage totals—not document text, prompts, raw audio, credentials or verification tokens. Propose 14-day operational logs and seven-day encrypted backup retention; legal retention requirements, if any, remain an owner decision.
6. No silent provider fallback. A provider switch changes privacy/cost assumptions and requires review. Enforce bounded token/image/audio requests, quota reservation and an application-side spending allowance; provider budget alerts alone are not a hard cap.

**Alternative:** fully self-hosted generation plus local transcription provides greater control over external disclosure, but requires a separately benchmarked, likely larger compute budget. If third-party processing is unacceptable, choose that alternative now. Do not keep the cheap hybrid budget while pretending local generation/transcription is already feasible or cutting those features.

**BRD fit:** §§7.2, 7.4–7.6, 8.3, 9.2, 11–14. OCR-only retrieval does not satisfy the mandatory multimodal extension.

## D4 — Identity, email verification and proposed contract

### Recommendation

Keep application-owned password/session authentication. Require proof of email control **before issuing a usable authenticated session**; provision Admin through a private operator action, never a registration role field. Recommend **Resend's HTTPS API** as the first transactional-email candidate, behind an adapter, with no marketing/open/click tracking. It requires a domain you control and verified DNS configuration; domain ownership/purchase is an unresolved owner prerequisite, not an existing connection. [1](https://resend.com/docs/add-a-domain)

Alternative: SES or another transactional provider if you already use it; a managed identity platform trades custom identity work for another external dependency and a larger contract/session migration. I do not recommend SSO/MFA/enterprise tenancy additions merely for this personal project.

Proposed defaults: 30-minute, single-use, high-entropy verification tokens stored only as hashes; 60-second resend cooldown and five requests/hour per email plus an IP budget; generic registration/resend acknowledgements to reduce enumeration. Session idle expiry 24 hours, absolute expiry seven days, no permanent login checkbox. Password changes revoke other sessions. These are proposed policy numbers, not BRD-specified constants.

Verification links open a frontend page with the token in the URL fragment; remove it from the address bar into memory immediately. No analytics on this route. **GET/link-preview scanners must not activate accounts.** The explicit confirmation POST requires the token **and the signup password**, preventing activation of a pending password chosen by somebody else who merely knew the email. Bind the token to its registration attempt; later requests must not overwrite the password behind an earlier link. Confirmation activates the identity but does not silently log the browser in.

### Draft contract changes — proposal only

All paths below are under `/api/v1`. Preserve the existing JSON error envelope. Mutations retain anonymous/authenticated session CSRF as appropriate and Origin checks.

**A. Registration and verification**

| Operation | Proposed request / response | Frontend consequence |
|---|---|---|
| `POST /auth/register` **changed** | Existing `{name,email,password}` → **202** `{status:"verification_pending", message, resendAfterSeconds:60, session:{user:null,csrfToken}}`. Use the same outward acknowledgement for an existing address; do not promise delivery/account creation for every request. | Login renders “Check your email” and resend/back-to-sign-in states; **no** registration success redirect or `auth.accept` with a user. |
| `POST /auth/email-verifications` **new** | `{email}` → **202** generic `{status:"accepted",message,resendAfterSeconds}`. Invalid syntax is 422; throttling is 429. | Resend flow, not a user-existence lookup. |
| `POST /auth/email-verifications/confirm` **new** | `{token,password}` → **200** `{status:"verified",next:"sign_in",session:{user:null,csrfToken}}`. Invalid/expired/used token or wrong password → safe 400/422 error, with attempt limits. | Explicit confirmation page; then sign in. No GET side effects and no token in storage/logs. |
| `POST /auth/login` **behavior extended** | Wrong credentials stay 401. Correct credentials for a not-yet-verified attempt/account → **403** `EMAIL_VERIFICATION_REQUIRED`; usable verified account → existing 200 `Session`. | Offer verification guidance only after credential proof. |
| `User` **extended** | Add `emailVerifiedAt: string` (ISO instant) for authenticated users. Pending registrations are not authenticated `User`s. Keep `Session = {user: User|null,csrfToken}`. | Session guards remain simple; fixtures/types must later be updated together. |

Create the usable account atomically on confirmation or atomically activate its isolated pending record. Tokens are consumed once; competing attempts cannot transfer ownership. If a different user is already signed in during a registration confirmation, require explicit sign-out rather than switching identities invisibly.

**Onboarding correction to approve:** once registration no longer creates a session, the transient `register` UI flag cannot route a later login. On verified sign-in, route users with `onboardingComplete:false` to Onboarding, retaining any validated destination for completion; otherwise use the safe destination/Dashboard. Keep Login's existing graphics, reduced-motion handling and one-form accessibility.

**B. Email changes**

Recommend separating identity changes from ordinary profile/preferences saving:

| Operation | Proposed semantics |
|---|---|
| `PATCH /settings` **changed request** | Accept name/capture/model preferences, **not email**. Continue returning canonical Settings including the current verified email. Explicitly reject an email-change attempt rather than silently ignoring it. |
| `GET /account/email-change` **new** | Current user only → `{currentEmail,pendingEmail:null|string,expiresAt:null|string}`. |
| `POST /account/email-change` **new** | `{newEmail,currentPassword}` → 202 pending confirmation, 30-minute expiry; retain the old verified address. Rate-limit and verify current password. |
| `POST /account/email-change/confirm` **new** | `{token,currentPassword}`, same authenticated account → 200 `{status:"changed",session,settings}`. Check uniqueness atomically at confirmation; unavailable address → safe 409. Rotate current session/CSRF, revoke other sessions and competing change tokens; notify old/new addresses. |
| `DELETE /account/email-change` **new** | Cancel own pending change → 204. A new authenticated request replaces the pending request, subject to resend limits. |

Settings must show “verification pending,” not “email saved.” Accepted document grants stay bound to immutable user IDs, not email strings. Pending invitations remain addressed to the intended current verified email; a changed email does not silently accept/reassign them. Do not apply provider-specific transformations such as removing dots or `+tags` when normalizing email identities.

This does **not** add unrequested SSO or pretend the existing app has forgotten-password recovery. Recovery policy can be proposed separately; no inert recovery control should be restored.

## D5 — Study-time measurement and proposed contract

### Recommendation and trade-off

Add **explicit Start / Pause / Resume / Stop** study sessions, optionally associated with an accessible document. Default is no recording. Show the timer and measurement explanation on Dashboard, with a small persistent control while active. Preserve user control across route changes. No keystroke tracking, camera observation, automatic “study” inferred from page views, or manual invented minutes.

Call the metric **“Recorded study time — user-started timer.”** It measures declared elapsed time, not attention, learning or productivity quality. Passive visibility tracking would miss physical reading and still cannot prove attention; manually entered durations are easy but less reliable and are not my first recommendation.

### Timing policy to approve

- At most **one open session per user**, including paused sessions, enforced transactionally across tabs/devices.
- Server timestamps and stored active intervals determine elapsed seconds; clients cannot submit elapsed time or backdated starts.
- Heartbeat every **30 seconds** while active; a **90-second lease** detects disconnected/closed clients. Count only confirmed intervals. On a stale heartbeat, pause at the **last confirmed time**, not lease expiry. Never silently credit offline time.
- A timely pause/stop confirms elapsed time through its server receipt. A heartbeat arriving after lease expiry cannot revive the timer; explicit Resume is required. Closing/reloading the page is not assumed to send a reliable final event.
- This can undercount up to roughly one heartbeat interval in ordinary healthy-network closure, and more after outages/throttling. Background/sleeping mobile tabs may pause; disclose that instead of claiming precision. A hidden tab does not by itself prove the user stopped studying.
- Return `serverTime`, reconcile after reload, and do not trust the browser clock. A four-hour wall-clock safety cap ends an open session at its confirmed boundary; a user can deliberately start another session.
- Store UTC intervals, split at requested IANA timezone day boundaries for reports, and clip to the requested period. Do not attach all cross-midnight duration to the start date.
- Allow deletion of one's own erroneous session, including removal from aggregates; no arbitrary duration editing initially. Never expose a shared document's now-revoked title through study history.

### Draft DTOs — illustrative, not added to `types.ts`

```ts
type StudySession = {
  id: string;
  status: 'active' | 'paused' | 'completed';
  startedAt: string;
  stoppedAt: string | null;
  confirmedThrough: string;
  measuredSeconds: number;
  leaseExpiresAt: string | null;
  pauseReason: 'manual' | 'connection_lost' | null;
  stopReason: 'manual' | 'safety_cap' | null;
  documentId: string | null;
  revision: number;
};
type StudySessionState = {
  session: StudySession | null;
  serverTime: string;
};
```

`confirmedThrough` is the last confirmed interval endpoint, not a claim that every second since `startedAt` was active. Internal interval rows remain authoritative. Revisions change on start/pause/resume/stop/automatic pause; ordinary heartbeats need not invalidate every UI action's revision.

| New operation | Proposed contract |
|---|---|
| `GET /study-sessions/current` | 200 `StudySessionState`, including any lease-expiry reconciliation |
| `POST /study-sessions` | Optional `{documentId}` + `Idempotency-Key` → 201 state. Another open session → 409 `STUDY_SESSION_OPEN`; read current rather than double-count. |
| `POST /study-sessions/{id}/heartbeat` | `{revision}` → 200 current state; expired lease remains paused. Transactional updates prevent overlapping interval credit. |
| `POST /study-sessions/{id}/pause` | `{revision}` + idempotency key → 200 canonical state |
| `POST /study-sessions/{id}/resume` | `{revision}` + idempotency key → 200 canonical state with new lease |
| `POST /study-sessions/{id}/stop` | `{revision}` + idempotency key → 200 completed state |
| `GET /study-sessions?from&to&timeZone&page&pageSize` | Standard paginated owned history; same date/zone conventions as analytics |
| `DELETE /study-sessions/{id}` | Owner only, revision precondition (If-Match) → 204; stop/remove if still open and invalidate aggregate values |

All routes require authentication; mutations also require CSRF. Stale state transitions return 409 with safe error code and a reload-current instruction. Heartbeats after deletion cannot resurrect a session. Idempotency binds actor/operation/content; retries do not create more time. Derive active current time for the display from the last server snapshot, but mark only confirmed seconds as recorded.

### Proposed analytics additions

Keep existing `studyMinutes` and `studyTimeDefinition`. Add:

```ts
// Additions inside Analytics, not a replacement of other fields:
studyTime: {
  method: 'explicit_timer_v1';
  measuredSeconds: number | null;
  sessionCount: number;
  timeZone: string;
  asOf: string;
};
```

Add `timeZone` to `/analytics?days=7|30|90`; default UTC for absent legacy callers, with the updated frontend sending its actual IANA zone. `studyMinutes` is the period's confirmed seconds / 60 rounded once to one decimal. `sessionCount` counts distinct sessions with confirmed intervals intersecting the period. Use null when the period has no confirmed measurement; measured durations below a minute may legitimately round to zero. An empty/unmeasured period is **not** evidence of zero studying. Timer presence, history and provenance must work before calling mandatory study-time analytics complete.

## D6 — Acceptance envelope, hosting limits and budget

### Verified hosting constraints

- Netlify's external proxy rewrites time out after **26 seconds**. The existing frontend's 45-second request timeout cannot override that. This is a proxy limit, not a Netlify Function/Form body limit. [1](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/)
- Render free web instances sleep after 15 minutes idle and take roughly a minute to wake; free databases expire after 30 days. Other service types such as background workers do not offer a free instance. Free services are not my durable complete-application recommendation. [1](https://render.com/docs/free)
- Current published paid compute examples are 512 MB/0.5 CPU $7/month, 2 GB/1 CPU $25/month, 4 GB/2 CPU $85/month. Managed PostgreSQL examples are 1 GB RAM $19/month and 2 GB RAM $40/month. A Hobby workspace has a $0 platform fee **plus compute**. Prices are observed list prices, not an account quote. [1](https://render.com/pricing)
- No account-specific Netlify plan, bandwidth allowance, body/upload limit, deployment region capacity or provider quota has been verified. Do not borrow Netlify Forms/Functions size limits and apply them to the external proxy.

### Resource recommendation

**Approve a bounded feasibility budget first, not a claim that a cheap tier is already sufficient.**

| Component | Lean feasibility profile | Larger full-feature candidate if profiling requires it |
|---|---|---|
| API, no loaded ML models | 512 MB / 0.5 CPU — $7/month | Same unless API RSS/latency fails; 2 GB costs $25/month |
| Worker | 2 GB / 1 CPU — $25/month; sequential heavy stages | 4 GB / 2 CPU — $85/month |
| PostgreSQL + vectors | 1 GB RAM — $19/month | 2 GB RAM — $40/month |
| Base compute total | **$51/month** | **$132/month** with the $7 API |

Compute amounts come from Render pricing. [1](https://render.com/pricing) These totals **exclude** extra database storage, artifact operations/storage, outbound traffic, Netlify charges, email/domain, model API usage, taxes and currency conversion. A larger API adds $18/month to either applicable total. Do not convert to INR using an invented exchange rate.

Propose a **$100/month feasibility ceiling**, including an initial **$20/month application-enforced model allowance**, subject to actual provider/account quotations. Treat this as a planning ceiling, not purchasing authorization or a guaranteed all-inclusive price. If full-feature benchmarks require the larger profile, return for approval of approximately **$175/month total planning allowance**, rather than silently resizing or omitting multimodal/handwriting features.

For the 2 GB worker, target peak RSS below 1.5 GB on the worst allowed item; do not keep OCR, handwriting and image models resident together merely for convenience. Stage/model reload overhead counts in latency. Move inference off the API. API target peak RSS <384 MB; keep combined database pools small (initially about 10 active connections across processes). Queue workers must not hold connections during model/network calls. Cache model artifacts in the approved build/artifact process; no runtime dependence on a new download before every request.

If budget is lower, compare a different approved storage/model mix or owner-operated hardware explicitly. Free instances, unlimited external API use and “all features on 512 MB” are not credible substitutes.

### Required additional transport changes for approval

**Async assistant, recommended now rather than waiting for intermittent proxy failures:**

- Change `POST /assistant/query` from synchronous `200 Answer` to **202** `{queryId,status,conversationId:null|string}` with a Location URL, preserving multipart/context and idempotency behavior.
- Add `GET /assistant/queries/{id}` → `{id,status:"queued"|"running"|"succeeded"|"failed"|"cancelled",result:Answer|null,error:null|{code,message}}` and an idempotent cancel action.
- API acknowledgement target <2 seconds; frontend polls about every two seconds with backoff/hidden-tab suspension and resumes by ID after reload. Persist accepted query IDs server-side and add `GET /assistant/queries?status=active` for owned pending runs (standard pagination) so a lost 202 response can be recovered using the idempotency key instead of submitting duplicate work.
- Worker persists the message pair only once; revalidate evidence access at completion and every result/history read. Pending query state is not a fabricated assistant message. Set a proposed 120-second job deadline with an honest timeout/failure result, not a 120-second HTTP request.
- Reuse internal job infrastructure but use a separate query-result DTO rather than placing `Answer` into today's ingestion `Job` schema without a contract change. Streaming is an alternative, but not a dependable workaround for an untested proxy path.

**Large uploads:** propose `/uploads` (authorized reservation/presigned write), `/uploads/{id}/complete` (validate/seal) and `uploadIds` in ingestion metadata as an alternative to multipart files. The browser transfers bytes directly to private quarantine with exact storage CORS rules; ordinary API control calls remain same-origin. Revalidate ownership, quota and immutable object version at ingestion. Keep current small multipart intake if it fits the tested path. Specify public per-kind/aggregate limits in Capabilities so the UI and server agree.

These are **additional proposed changes**, alongside D4/D5, not edits already made to `openapi.json`. The existing JSON 503 fallback and Netlify configuration remain untouched.

### Proposed acceptance envelope

These numbers are **targets to approve and test**, not current performance/results, provider quotas or silently assumed BRD requirements.

| Dimension | Proposed baseline |
|---|---|
| People/load | One primary user plus four invited test accounts; three concurrently active browsers; five ordinary API requests/second during the load check |
| Corpus | 3,000 documents, approximately 50,000 text chunks and 10,000 image/region vectors; evaluate actual ACL-filtered retrieval |
| Storage | Initial 10 GB artifact budget, quotas configurable through Admin; start around 5 GB database allocation and measure metadata/index growth |
| Intake | Up to 10 files/batch and 250 MB total via approved upload path; image 20 MB, PDF/DOCX 25 MB, audio 100 MB; plain text 100,000 characters; max 100 PDF pages/file |
| Image processing | Reject decompression bombs; max 20 megapixels decoded input, bounded processing image about 8 megapixels, preserve original; sequential page processing |
| Audio | Up to 60 minutes per recording/file, also subject to byte/codec limits; test long compressed recordings and segmented transcription, not only short clips |
| Language | English release acceptance for OCR/transcription/retrieval; mixed-language evaluation reported separately, no unapproved multilingual accuracy promise |
| Browsers/devices | Current stable Chrome, Edge, Firefox and Safari; physical Android Chrome and iPhone Safari camera/mic; widths 320/390/768/1280+ |
| Ordinary API latency | p95 <1 second on the warm agreed profile/load, excluding file transfer and model jobs |
| Retrieval / answers | Retrieval p95 <1 second; end-to-end text answer median ≤6 seconds / p95 ≤15 seconds; multimodal p95 ≤25 seconds, including normal query queue wait but excluding client upload transfer |
| OCR | Printed page OpenCV+OCR median ≤3 seconds / p95 ≤8 seconds; handwriting p95 ≤20 seconds; report queue/indexing separately and target a normal single printed page searchable within 20 seconds after upload |
| Transcription | End-to-end processing ≤0.5× recording duration on the agreed clean/noisy test mix, excluding initial client upload |
| Reliability | No lost acknowledged jobs/messages or duplicate task/artifact effects in injected restart/retry tests; zero authorization leaks in the test matrix |
| Recovery | Proposed RPO ≤24 hours, RTO ≤4 hours for the evaluated corpus; encrypted DB/artifact backups and a rehearsed restore, including vector rebuild or restoration |

The BRD asks for typical processing/query results within a few seconds (§8.1); the proposed medians and tail budgets make that measurable, but require your approval. If they fail, report failure and adjust resources/model design or seek an explicit revised target—do not rename the slow path “complete.” Model downloads/cold starts are measured separately, not hidden from the operating report. Transfers must be tested on a normal connection and a throttled mobile link, including cancellation/resume/range access.

## Evaluation-baseline specification (not collected or executed)

Create the following **only after approval of data use and an execution step**. Use owner-consented or suitably licensed, non-sensitive samples; no real private material in Git.

1. **Classification/topics:** 400 labeled documents: 250 training, 50 development, 100 held-out; five initial types (lecture note, assignment, project report, bill, other), with balanced held-out classes and separately labeled topics. Split by document/session family so scans and near duplicates do not cross partitions.
2. **OCR:** 60 ground-truth pages, 20 clean printed, 20 handwritten, 20 degraded/whiteboard/slide pages. Record orientation, lighting, language and segmentation failures. Do not drop hard pages from the denominator.
3. **Tasks/meetings:** 200 labeled passages (actions and non-actions) plus ten meeting bundles with human-checked decisions and task/source annotations. Split participants/session families to avoid leakage.
4. **Audio:** twelve approximately five-minute consented clips covering clean/noisy speech, plus a 60-minute long-recording workflow test. Transcribe reference text independently.
5. **RAG:** 120 held-out questions: 60 answerable text, 30 image-dependent, 30 unanswerable/adversarial; identify supporting documents/pages/regions. Include queries whose answer disappears after sharing revocation. Use a separate development set for prompt/retrieval tuning.
6. **Scale/security:** a non-sensitive 3,000-document load corpus plus owner/view/edit/outsider/Admin accounts. Include revocation mid-query, stale source links, email-verification races, expired sessions, permission downgrade, job crashes and timer multi-tab/offline races.

### Proposed quality gates

| Measure | Initial threshold for approval |
|---|---|
| Supported valid-file ingestion | ≥98% success on the fixture set; every unsupported/corrupt item reports an accurate bounded failure; zero silent partial successes |
| OCR character error rate | ≤5% clean printed; ≤20% legible English handwriting; degraded cohort separately reported and retake/correction behavior validated |
| Transcription word error rate | ≤15% clean English, ≤25% agreed noisy cohort |
| Classification / topics | Macro-F1 ≥0.80 on held-out classes; human-labeled topic precision@3 ≥0.80 |
| Action detection | Precision ≥0.90, recall ≥0.80; zero duplicate tasks in retry tests; source identity correct for every accepted task |
| Retrieval | Supporting-source recall@5 ≥0.90 text and ≥0.80 image-dependent, plus modality ablation showing actual image retrieval contributes |
| Answers | ≥95% of substantive claims supported by cited evidence; ≥95% correct abstention on unanswerable cases; all citation IDs/pages valid and authorized |
| Security/timekeeping | Every negative-access test passes; zero overlapping timer credit, replay duplication or client-forged elapsed time in the test matrix |

Small evaluation sets are not statistical certification. Report raw numerators/denominators, per-cohort failures and model versions; add samples if a threshold is unstable. Owner reviews the answer/topic rubric and a second review of disputed examples before acceptance. Hash a private manifest and record preprocessing/model/index revisions, software/resource profile, timings and costs. Freeze held-out tests before tuning; never lower a target only after seeing an unfavorable result without explicit review.

## Contract impact and approval checklist

**Unaffected now:** `frontend/src/api/types.ts`, `frontend/scripts/generate-contract.mjs`, `docs/openapi.json`, `docs/BACKEND_HANDOFF.md`, package manifests/lockfile and `netlify.toml`. They remain the current implementation contract until later coordinated changes are authorized.

If approved later, change DTOs + generator + generated OpenAPI + handoff + frontend states + tests together. API/schema tests must validate real payloads and permission semantics. Do not introduce incompatible server responses while leaving the current frontend pointed at them.

Please approve or amend each line:

- [ ] **D1:** FastAPI/Pydantic/SQLAlchemy/Alembic + managed PostgreSQL; separate API/worker, same modular codebase.
- [ ] **D2:** Private R2, pgvector as the explicit indicative-stack addition, and PostgreSQL-backed jobs; authenticated revocable source gateway.
- [ ] **D3:** Hybrid external-processing policy and named evaluation candidates, including OpenAI generation/transcription; acknowledge retention trade-off. Otherwise choose fully self-hosted and revisit resources.
- [ ] **D4:** Verified-before-login, Resend/domain prerequisite, proposed verification/email-change/session policy and onboarding adjustment.
- [ ] **D5:** Explicit study timer, 30/90-second confirmation policy, proposed routes/DTOs and timezone-aware analytics.
- [ ] **D6:** Resource-trial/budget envelope and quality/device/load targets; async query and upload-transport proposals.
- [ ] **Owner inputs:** maximum acceptable monthly spend and any hard deadline; domain availability; permission for selected excerpts/images/audio to reach the proposed provider; additional required languages/devices or stricter recovery/privacy targets.

Approval of these choices does **not** override the current prohibition on implementation/package installation/contract edits. Next, agree a separately authorized feasibility/evaluation task; close M0 only with recorded decisions and evidence. No commit/push or deployment is performed as part of this proposal.
