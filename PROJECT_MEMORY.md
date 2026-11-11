# KnowFlow Project Memory

_Read this first. Updated when M0 was closed on 2026-11-10._

## Authority and approved scope

- Personal knowledge/productivity project. The BRD PDF in the repository wins over README/design exports and earlier “enterprise” language.
- User requested five gated phases. Phases 1–3 (understanding, grouped doubts, read-only audit) were completed before edits. Phase 4 was explicitly approved for **all 41 findings/all four groups**, including every BRD future feature. Phase 5 planning is approved in principle and Milestone M0 is closed in `docs/M0_DECISION_RECORD.md`. M1 was later authorized and its exit result is in `docs/M1_EXIT_REPORT.md`. M2 is implemented locally; its exit result is in `docs/M2_EXIT_REPORT.md` and awaits approval. Contract edits, deployment, and a `main` merge are not authorized. M3+ is not authorized.
- Full required frontend, not an MVP: authentication/User/Admin, ingestion/camera/OCR-review UI, classification corrections, meetings, tasks, library/timeline, grounded assistant, settings/onboarding, audio transcription UI, multimodal query/citation UI, collaboration and personal analytics.
- BRD §14 p8 says “Collaborative use cases (sharing workspaces with classmates or team members).” This was quoted and clarified with the user. The explicit answer was **selected-document sharing with permission control, not shared workspaces**. Implemented owner/view/edit grants, recipient invitations and revocation UI.
- Netlify frontend; Render free web service approved for the backend. Gemini and Groq are approved only for the uses and non-sensitive data named in `docs/M0_DECISION_RECORD.md`. Browser configuration contains public API settings only; the backend owns credentials, adapters, storage, and ML.
- Keep existing React/browser runtime stack. No Zustand/Query/Zod/form-library additions. Production-grade accessibility/error handling/responsiveness are requirements, not unverified claims of certification.
- The user explicitly approved development-only regression tools, as devDependencies only, with exact additions/reasons recorded here. Do not commit/push unless asked.

## Current implementation

API-driven React/TypeScript SPA. Runtime dependencies remain React/React DOM, React Router, Tailwind, Framer Motion, Lucide, Three.js, Recharts, clsx and tailwind-merge. Native fetch/AbortController/FormData/media APIs and React hooks/context handle networking/state. No application runtime test fixtures or backend-free success simulation.

All domain routes are lazy loaded. Session/CSRF and role guards are in `frontend/src/auth/`; shared DTOs/client/resource/action hooks in `src/api/`. Domain screens and shared form/feedback/media/sharing components use that boundary. Raw Three.js landing hero and restored Login network are separate optional-motion lazy imports; shader/Three resources have cleanup, reduced-motion/static failure paths and visibility suspension. Inert enterprise claims/controls and externally hosted decorative font/image dependencies were removed.

The backend is **not implemented**. Live authenticated persistence, OCR/transcription/classification/RAG, real metrics and authorization require the later service. The frontend honestly reports unavailability until connected. The formal provider-neutral handoff is `docs/openapi.json` plus `docs/BACKEND_HANDOFF.md`; do not replace it with a production mock store.

### Key locations

| Path | Responsibility |
|---|---|
| `frontend/src/App.tsx` | Public routes, lazy protected routes, Admin gate, not-found/error containment |
| `frontend/src/api/types.ts`, `client.ts`, `hooks.ts` | DTOs, encoded API access, cookies/CSRF/errors/timeouts, cancellation and single-flight mutations |
| `frontend/src/auth/` | Session bootstrap/refresh/expiry, login acceptance, logout and guards |
| `frontend/src/pages/` | Capture/jobs, documents, tasks, meetings, assistant, timeline, analytics, settings/Admin, onboarding/sharing |
| `frontend/src/components/ui/` | Named fields, feedback/dialog/pagination, media capture, owner sharing controls |
| `frontend/scripts/generate-contract.mjs` | Existing TypeScript compiler generates schemas; explicit endpoint/request/permission definitions |
| `docs/openapi.json` | Generated OpenAPI 3.1 contract; check regeneration before integration |
| `netlify.toml`, `frontend/.env.example`, `.nvmrc` | Node/build/SPA/API fallback/header and public environment settings |
| `frontend/src/**/*.test.*`, `frontend/tests/` | Unit tests and isolated browser HTTP fixtures; not imported by the application |
| `.github/workflows/frontend.yml` | Added build/type/lint/unit/contract/audit/browser CI gate; remote execution not yet observed |
| `docs/PHASE_4_REPORT.md` | F01–F41 resolution evidence, D01–D19 reconciliation and verification limits |

## Exact development-only additions

All seven packages below were added to **devDependencies**, not dependencies. Versions are the resolved lockfile versions at Phase 4 verification. Their transitive packages are pinned in the lockfile too; for example, axe-core is pulled in by the browser accessibility integration.

| Package | Resolved version | Why added |
|---|---|---|
| `vitest` | 5.0.4 | Unit/component regression runner for API, auth, hooks, intake, counters and media lifecycle |
| `@testing-library/react` | 16.3.3 | Render React components/hooks and assert user-visible behavior |
| `@testing-library/user-event` | 14.6.8 | Realistic button/input interactions in component tests, including media controls |
| `@testing-library/jest-dom` | 7.0.1 | DOM assertions for names, content, disabled state and presence |
| `happy-dom` | 21.0.1 | DOM environment for unit tests; incomplete Web Animations support is disabled only in test setup |
| `@playwright/test` | 1.64.1 | Real Chromium route/workflow/viewport/keyboard/error tests with isolated API interception |
| `@axe-core/playwright` | 4.13.0 | Automated WCAG A/AA rule checks in browser route states |

No permanent production library was added. `@react-three/fiber` and `@react-three/drei` were removed only after their disconnected component chain was removed; raw `three` remains. Existing compatible package ranges were resolved to patched versions, including `react-router-dom` 7.18.4 and `oxlint` 1.74.0. React/React DOM are 19.2.7; Vite 8.1.5; Three 0.185.1. `package-lock.json` remains the complete exact-version authority.

One-off code formatting used `prettier@3.6.2` through npm exec/npx; it was not added to the project's dependency manifests. Restricted-sandbox browser runs used a temporary Chromium executable and shared libraries outside the repository. These are audit/test tooling, not application artifacts or runtime dependencies. Normal local/CI setup installs Playwright's Chromium.

## Validation and remaining external boundaries

- Node pinned to **22.22.3**; engine range `^22.12.0 || >=24.0.0` accommodates installed test tooling. Old “Node 18+” guidance is obsolete.
- Verified production build, test TypeScript, strict lint (zero warnings/errors), deterministic contract check and npm audit (zero advisories at check time).
- **30 unit tests passed (eight files); 25 Chromium browser tests passed.** Automated WCAG 2 A/AA and 2.1 AA rules reported no violations on 12 authenticated route states plus Landing/Login. This does not certify every state, screen reader or browser.
- Browser coverage includes 320/390px phones, a short 768px tablet and 1280/1440px desktop layouts; API failure, role denial, persistence, selected sharing, source links, retry/idempotency and WebGL-off behavior. Media tests use simulated streams/recorders plus real-browser permission-denial handling; physical hardware is not certified.
- Build still emits a non-blocking **lazy Three.js ~526 kB** warning. Route/chart/hero splitting is implemented; no warning threshold was raised to conceal it. No blanket 60fps/latency/SLA claim is made.
- Actual Render/Netlify integration, model correctness, identity/email verification, server ACLs, quotas and metric provenance remain backend/deployment acceptance responsibilities—not completed frontend execution.
- The Netlify API rule deliberately serves JSON 503 before the SPA fallback until the real Render proxy is substituted. No live deployment or remote CI success is claimed. Publication was subsequently authorized (see below).
- Phase 5 roadmap is approved in principle. M0 recommendations are delivered in `docs/M0_DECISION_PROPOSAL.md` for explicit D1–D6 approval; implementation, package installation and existing-contract edits are prohibited at this step. No backend or deployment has started.

## Historical correction

Before this phase, the repo was a visual frontend with local mock arrays, navigation-only authentication, 17 production TypeScript errors, 15 lint warnings and eight audited dependency entries. Earlier memory/context/README documents called it enterprise-grade, suggested unapproved state/fetch libraries, counted routes inaccurately and presented visual completion as functionality. That was historical context, not binding scope. The original files remain in Git history; the Phase 3 audit was delivered at `/home/user/KnowFlow-Phase-3-Audit.md` in the working environment.

## Preview follow-up

The user reported `appendChild: Cannot use import statement outside a module` while opening the hosted preview, with non-KnowFlow bundle filenames and Mintlify telemetry in the console. Served development HTML correctly marks all entry/refresh scripts as modules. Direct local Chromium checks rendered Landing and Login on both development port 5173 and production-preview port 4173 with zero uncaught script errors; the preview Host header was accepted (HTTP 200). Started `npm run preview -- --host 0.0.0.0 --port 4173 --strictPort` as a development-script-free alternative. An external preview wrapper is suspected, not confirmed; the user's hosted-browser outcome still needs confirmation. No application/auth changes or Phase 5 work were made for this report.

The next user screenshot confirmed an E2B 502 **SANDBOX NOT FOUND** response at the public 4173 URL. Local HTTP still returns 200 and the environment identifier is unchanged. Restarted the production preview registration on 4173; public reachability remains unconfirmed (outbound curl failed TLS negotiation). Do not describe this as a fixed application import error or keep claiming local 200 proves external reachability. Created `/home/user/KnowFlow-preview.zip` as a downloadable fallback containing the existing production build, instructions and a dependency-free Node local SPA server that returns honest JSON 503 for `/api/*`. No new application dependency, auth bypass, backend implementation or Phase 5 work was introduced.

## Git publication authorized

The user subsequently asked to push the completed frontend so they can fetch it into their existing local KnowFlow checkout and run it there. This explicitly authorizes committing and publishing the Phase 4 work to `arena/d9bd44f3-knowflow` only. It does not authorize merging into main, deployment, or Phase 5. Use Git history and the remote branch for publication status; the earlier no-commit/no-push statements describe the original Phase 4 handoff.


## Login visual restoration — approved Phase 4 correction

The user objected to removal of the original Login presentation and explicitly approved restoring it **while retaining API-backed auth, validation, accessibility, reduced motion and graphics fallback**, with publication to the same `arena/d9bd44f3-knowflow` branch. Functional fixes did not authorize stripping the existing design. Preserve approved visuals; repair their lifecycle and accessibility rather than making active components “unused” by removing their callers.

- Restored the original design in `frontend/src/pages/Login.tsx`: warm glass two-column composition, staggered left-hand cards, animated card entrance, network watermark, Three.js network, wave/particle shader, pixel shimmer and spring-driven 3D sign-in/register flip.
- Restored/hardened `src/components/3d/{NetworkGraph,ShaderBackground}.tsx` and `src/components/ui/PixelCard.tsx`. Pixel shimmer supports pointer hover and keyboard focus. Canvas work is bounded/throttled, pauses in hidden tabs and disposes RAFs/observers/listeners/GPU resources; graphics failure leaves the functional form and a static background. Shader context restoration is browser-tested.
- `src/hooks/usePrefersReducedMotion.ts` subscribes to live OS preference changes (the installed Framer hook samples only at mount). Reduced preference stops/deallocates Login decorations and disables JS flip/entrance/button transforms without requiring a reload.
- Only one form is mounted; exiting content is inert/hidden to assistive technology. Mode changes clear the password and move focus to the new heading. Real request/validation/loading/error/session/CSRF behavior is retained. Fixed competing imperative/declarative redirects uncovered by the new registration test: a single authenticated redirect now takes registration to Onboarding and sign-in to its safe requested destination.
- Did **not** restore fake delayed login, sample credentials, inert social/forgot-password controls or invented recent activity. The glass side cards now describe capabilities honestly. No dependency or API-contract changes.
- Added six browser cases in `frontend/tests/login-visuals.spec.ts` and three unit cases for the live preference subscription and PixelCard StrictMode/hidden-tab/cleanup/null-canvas behavior. Full latest checks: build, strict lint, test types, **30 unit / 25 browser tests**, contract synchronization and zero-vulnerability audit all passed locally. Normal-motion and reduced-motion Login axe checks passed; desktop screenshot reviewed. The lazy Three chunk warning remains (~526 kB); cross-browser/hardware/backend integration are not certified.
- Updated `docs/PHASE_4_REPORT.md` with the correction and current evidence. The earlier downloadable preview ZIP predates this restoration; use the branch source/build instead. No backend, deployment, main-branch merge or Phase 5 work was done.


## Phase 5 — roadmap delivered (2026-10-15)

The user explicitly said “lets start phase 5.” This authorizes roadmap/dependency/risk/milestone planning, not backend implementation, dependency installation, deployment or new publication. The reviewed source baseline is **`1df6b73f4ac2a4571c2017bf832cd85d5da6e3aa`**, the restored Login correction already verified on `origin/arena/d9bd44f3-knowflow`.

- Read the actual nine-page BRD, current code/DTOs/operations, handoff, architecture and Phase 4 evidence. Delivered **`docs/PHASE_5_ROADMAP.md`** with full mandatory-feature traceability, M0–M10 milestones, dependencies, acceptance gates, risks, evaluation/release criteria and approval boundaries.
- Proposed sequence: M0 decisions → M1 identity/persistence/ACL/settings/Admin → M2 durable ingestion/OpenCV/OCR/library/timeline → M3 ML/topics/tasks → M4 text RAG → M5 meetings → M6 transcription → M7 multimodal RAG → M8 selected-document sharing → M9 measured analytics → M10 full-stack release validation. ACL foundations begin at M1, not M8. No intermediate milestone is an MVP release or a feature cut.
- Decisions D1–D6 remain open: backend/persistence, durable storage/index/jobs, model/privacy strategy, identity/email verification, study-time measurement and budget/capacity/acceptance envelope. Python/FastAPI/PostgreSQL and explicit user-controlled study sessions are recommendations only, not approved choices. No provider was selected and no calendar deadline was invented.
- Explicit integration checkpoints: registration/email changes need pending-verification semantics and UI; actual study-time collection is absent; ordinary signed URLs alone cannot guarantee immediate sharing revocation; the synchronous assistant must fit the 45-second client timeout and actual proxy limits or receive an approved contract change; source serving/reindex consistency must be specified.
- Do not treat `studyMinutes:null` as final delivery of mandatory study-time functionality, OCR-only retrieval as completion of multimodal image embeddings, or removal of citation links as sufficient redaction of previously generated restricted answer text.
- Reconciled stale README test counts/planning status/visual-cleanup wording and the architecture document's Landing-only Three.js claim. These are documentation corrections, not new runtime changes. Historical D01–D19 conflicts remain in the Phase 4 report.
- No application/backend code, dependencies, schemas or deployment configuration changed. Phase 4 test results are quoted historical evidence (30 unit/25 browser); tests were not rerun for this documentation-only phase. Remote CI and hosted integration still are not claimed. No commit or push was made for Phase 5.
- **Stop here for owner review.** Next recommended step is approving the plan and resolving D1–D6, then separately authorizing an implementation milestone. Existing Phase 4 publication permission does not automatically publish this plan or authorize a main merge.


## M0 — decision proposal and evaluation specification (2026-10-15)

The owner approved the Phase 5 roadmap **in principle** and authorized M0 recommendations/evaluation-baseline planning. Explicit prohibition: **no backend code, package installation or changes to existing contracts**. Do not treat recommendations or numeric targets as adopted decisions or completed evaluation.

- Delivered `docs/M0_DECISION_PROPOSAL.md`, with D1–D6 recommendations/trade-offs, isolated draft contract shapes, concrete resource/cost choices and a held-out evaluation specification. No dataset collection/model trial was run.
- Proposed FastAPI/Pydantic/SQLAlchemy/Alembic + managed PostgreSQL, API/worker in one region, R2 private objects, pgvector and PostgreSQL-backed leased jobs. pgvector is explicitly outside the BRD's named indicative vector examples and needs approval; Qdrant is the named-list alternative. No new stack/provider has been adopted.
- Model candidates: OpenCV/Tesseract, line-segmented TrOCR small handwriting, MiniLM 384-dimension short text embeddings, SigLIP base image/text retrieval; TF-IDF/logistic classification and embedding clustering; hosted OpenAI GPT-5.4 mini and GPT-4o mini transcription behind replaceable adapters. All require owner privacy approval, licensing/version review and quality/resource trials. Fully self-hosted is the privacy alternative with a separately evaluated compute budget.
- Verification proposal: 202 pending registration, anonymous session until email proof, token+signup-password confirmation followed by sign-in, generic resend, separate verified email-change routes, private Admin provisioning, and onboarding based on persisted onboardingComplete rather than transient registration mode. Resend is a transactional-email candidate; owned sending domain is not established.
- Study proposal: explicit sessions, server-confirmed intervals, 30-second heartbeat/90-second lease, no offline credit, single open session, multi-tab revision/idempotency guards, history/deletion and timezone-aware analytics. Draft DTOs/routes live only in the new proposal, not executable contracts.
- Official hosting docs checked: Netlify external proxy timeout is **26 seconds**, shorter than current client's 45 seconds; recommend explicit async assistant query/result/cancel/list contract. Large uploads need scoped direct-to-private-storage quarantine writes plus completion validation; reads remain revocable through an authenticated gateway, with range/slow-transfer testing.
- Render docs confirm pgvector support, non-shared persistent disks, free service sleep and free DB expiry. Observed paid compute examples produce **$51/month lean trial** (API7+worker25+DB19) versus **$132/month larger candidate** (API7+worker85+DB40), before storage/traffic/Netlify/email/domain/AI/taxes. Proposed total trial planning ceiling $100/month incl. $20 model allowance; larger deployment planning allowance ~$175/month requires separate approval. None is an account quote, guarantee, purchase or auto-upgrade approval.
- Concrete proposed acceptance envelope: 3,000 documents/50,000 text chunks/10,000 image vectors, small personal/shared usage, English primary, physical camera/mic and major-browser tests, measured latency/RSS, quality gates, RPO24h/RTO4h. These are proposed targets, not measurements; all mandatory features remain.
- External provider retention is not zero by default. OpenAI API generation may have content-bearing abuse monitoring retention; `store:false` is not a no-retention guarantee. No private data was sent for model evaluation.
- Only a new proposal document and this memory update were made in this turn. Existing contracts, frontend/backend source, manifests/lockfile and deployment config stayed unchanged; no commit/push. Earlier Phase 5 documentation changes remain in the working tree.
- **M0 remains awaiting explicit decisions and later authorized feasibility evidence.** Stop for D1–D6 approval and owner budget/domain/privacy/acceptance inputs; no implementation action is authorized yet.

## Planning documents published at owner request

The owner asked to push the latest code before giving the next instruction. This publication contains only the Phase 5 roadmap, the M0 decision proposal, and the related memory, README, and architecture notes. It does not approve D1–D6, change application code or existing contracts, install backend packages, deploy, or merge `main`.

## M0 amended to $0 and feasibility baseline (2026-11-10)

The owner first approved the paid M0 recommendations, then amended them before implementation. The amendment is authoritative:

- Strict monthly ceiling is **$0**. No card, auto-recharge, or paid fallback.
- D1: one free-tier FastAPI service and in-process asynchronous work, not a paid separate worker.
- D2: Cloudflare R2; pgvector on free Postgres, with Qdrant Cloud free only if the database cannot hold the index; database-backed jobs.
- D3: local OpenCV/Tesseract; Google Gemini free tier for generation and multimodal questions; Groq free Whisper. Selected excerpts, query images, and audio may leave the app for those two providers.
- D4: verification logic remains; local and free staging print activation links to logs because there is no paid sending domain.
- D5: explicit server-recorded study timer approved.
- D6: presigned R2 uploads and async assistant calls approved because of Netlify's 26-second proxy timeout.

`docs/M0_FREE_TIER_FEASIBILITY.md` records the official limits checked on 2026-11-10 and the evaluation baseline. No packages were installed, no provider was called, and no existing contract was edited.

- Feasible at $0: a small personal functional baseline. Not feasible: always-on processing, the 3,000-document envelope, warm few-second answers after idle, reliable local handwriting, 24-hour recovery, or production email.
- Recommended $0 combination, still not deployed: Render free web (512 MB, 15-minute sleep, 750 hours), Neon Free Postgres with pgvector (1 GB, 100 CU-hours, 5-minute scale-to-zero), R2 Standard free tier, Gemini's current free Flash model, and Groq Whisper with Zero Data Retention. Render free Postgres is rejected because it expires after 30 days. New Hugging Face Docker/Gradio Spaces require a paid plan.
- Free Gemini content is documented as used to improve Google's products. That is broader than the owner's consent and blocks any Gemini call until explicitly accepted or rejected. Groq is not documented as training on customer data, but abuse/reliability logs can last 30 days unless ZDR is enabled.
- Embeddings and handwriting are open. Lexical Postgres search is the measured retrieval baseline until a local model is profiled or whole-library embedding consent is given. Do not treat that as completion of semantic or visual retrieval.
- Jobs must be Postgres-backed and advanced one short unit per poll. In-memory background tasks die on free-tier sleep. Streaming does not defeat the Netlify proxy timeout.
- Implementation remains unauthorized at the time of that feasibility note. The four open choices were later closed; see the section below.

## M0 closed (2026-11-10)

The owner accepted the $0 trade-offs and closed M0. The authority is `docs/M0_DECISION_RECORD.md`. The proposal and feasibility documents are historical evidence, not open decisions.

- Google free-tier product-improvement terms are accepted for personal/academic evaluation of non-sensitive test documents and synthetic data only.
- Text chunks may go to Google's free embedding API. `text-embedding-004` is not the pin: official deprecations show it shut down on 14 January 2026. The recorded pin is `gemini-embedding-001`, 768 dimensions, `RETRIEVAL_DOCUMENT` / `RETRIEVAL_QUERY`, one chunk per request, stored in Neon pgvector. `gemini-embedding-2` is only a new index version if 001 is unavailable. Page images are not embedded under this decision.
- OpenCV does local boundary detection, perspective correction, and contrast enhancement. Gemini Vision transcribes printed and handwritten pages. Tesseract is not the approved transcription engine.
- Host is confirmed: one Render free FastAPI service, Neon Free with pgvector, and R2. Jobs are database-backed and advanced one short poll at a time. Assistant calls are asynchronous. Email verification stays log-only for local development and free staging.
- The evaluation baseline is specified and approved as a report-only measurement plan. It has not been executed. The 3,000-document envelope, always-on latency, 24-hour recovery, and production email remain unmet at $0 and are not permission to cut features.
- No package was installed and no existing frontend contract was edited at M0 close. M1 was authorized afterward; see the section below.

## M1 exit (2026-11-11)

The owner authorized the trusted-service foundation only. The result is `docs/M1_EXIT_REPORT.md`.

- One FastAPI app, SQLAlchemy, and Alembic live under `backend/`. Tests use a temporary SQLite file. Neon was not connected, and nothing was deployed.
- `POST /auth/register` returns the published `201 Session` shape with `user: null`. An unverified account does not receive an authenticated session. The one-time token is printed to stdout. `POST /auth/email-verifications/confirm` is the handoff redemption path and is not in the frozen frontend operation list.
- Isolated pytest result: **14 passed, 1 warning**. The warning is Starlette's deprecation of `httpx` with `TestClient`. No Gemini, Groq, or file-processing call exists in this milestone.
- The published Login page will not explain the log token, because a successful `Session` has no message field and the frontend was not edited. That integration gap remains.
- This work is local and uncommitted. `origin/arena/d9bd44f3-knowflow` remains `f925831`. `main` was not changed.
