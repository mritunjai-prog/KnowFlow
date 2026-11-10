# KnowFlow — Phase 5 roadmap, dependencies, risks and milestones

**Date:** 15 October 2026  
**Baseline reviewed:** `1df6b73` on `arena/d9bd44f3-knowflow`  
**Status:** Planning deliverable complete; proposed execution plan awaits approval. Backend implementation, new dependencies, deployment and publication of this plan are not authorized by starting Phase 5.

## 1. Scope and evidence

This roadmap completes the fifth requested phase. It is not a new implementation phase and does not reopen the already approved product scope.

Authority, in order:

1. `BRD  Intelligent Personal Productivity Hub Using ML, OpenCV, and RAG.pdf` (nine pages), together with explicit owner clarifications.
2. Owner decisions: full personal application, every BRD feature mandatory, User/Admin required, selected-document view/edit sharing rather than shared workspaces, Netlify frontend and Render backend, provider-neutral configuration and no unapproved frontend runtime additions.
3. Actual code and contracts: `frontend/src/api/{types,client}.ts`, `frontend/scripts/generate-contract.mjs`, `docs/openapi.json`, `docs/BACKEND_HANDOFF.md`, route components and deployment/test configuration.
4. Historical evidence: `PROJECT_MEMORY.md`, `docs/PHASE_4_REPORT.md` and the Phase 3 audit. README is secondary, not requirements authority.

### Present state versus remaining work

| Area | Established baseline | Still required for the complete application |
|---|---|---|
| Frontend | API-connected screens, auth/role guards, capture/review, documents, tasks, meetings, assistant, sharing, analytics, settings/onboarding/Admin; original Login graphics restored | Real-service integration, any explicitly agreed contract-state additions, physical-device/browser/manual accessibility acceptance; preserve the approved design |
| API | Provider-neutral `/api/v1` DTOs, operation descriptions, errors, jobs, source references, permissions and generated OpenAPI | Executable server, runtime validation, migrations, persistence and conformance tests |
| Processing | Capability-driven controls and real request/job UI, not simulated processing | OpenCV, OCR, parsing, classification/topic models, action detection, transcription and durable execution |
| Retrieval | Query/image/context inputs, evidence/insufficient-evidence output and source links | Embeddings/indexes, authorized retrieval, grounded generation, actual multimodal retrieval and quality evaluation |
| Infrastructure | Netlify build/SPA configuration; `/api/*` intentionally returns JSON 503 | Render service/worker and persistent stores, actual Netlify reverse proxy, private secrets, HTTPS, recovery and operational checks |
| Verification | Phase 4 recorded **30 unit and 25 Chromium browser tests passing**, build/type/lint/contract checks passing and zero audit vulnerabilities at that time | Backend/real-stack tests, independent remote CI evidence, ML quality and device/performance/security evidence |

The baseline results above were read from the previous verification and files, **not rerun as new evidence in this documentation-only phase**. No backend or live deployment exists in this checkout. The old downloadable preview ZIP predates the Login correction.

### Scope conflicts resolved explicitly

- BRD §§4.2 and 14 (pp. 2, 8) label audio, advanced multimodal RAG, collaboration and analytics optional/future. The owner promoted **all four to mandatory delivery**.
- BRD §§5 and 7.8 (pp. 2, 5) label Admin/simple roles optional. The owner requires User/Admin and an Admin panel.
- BRD §12 (p. 8) suggests meeting workflows/advanced automation as stretch goals. That prioritization **cannot cut them from this application's final acceptance**. Earlier implementation order is not reduced scope.
- BRD §14 (p. 8) mentions sharing workspaces. The clarified requirement is **selected-document permission sharing**, not enterprise tenancy or shared workspaces.
- BRD §§9 and 11 (pp. 6, 8) list alternative/indicative technology choices. They are not evidence that a backend framework, database or model provider has already been selected. React/browser stack and Netlify/Render are settled owner decisions.
- All original README/BRD discrepancies D01–D19 remain enumerated in `docs/PHASE_4_REPORT.md`. This phase also corrects stale secondary-document claims: README's 27/19 test counts and Phase 5 gating text, its overly broad visual-cleanup description, and `PROJECT_FRONTEND_CONTEXT.md` saying raw Three.js exists only on Landing. Actual baseline is 30/25 with the restored Login network.

No enterprise SSO, complex organizational RBAC, shared workspaces, new email/code ingestion connectors, or new frontend state/form/provider SDK is introduced by this roadmap. BRD §8.2's extensibility requirement informs module boundaries; it does not require implementing every hypothetical future connector.

## 2. Decision gate before implementation (M0)

Resolve these together, document the chosen options and obtain owner approval before installing backend packages or changing application contracts. Recommendations are proposals, not selections already made.

| ID | Decision | Recommendation / options | Blocks |
|---|---|---|---|
| D1 | Backend framework and persistence | Prefer a **Python modular service**, with FastAPI as the first candidate, because OpenCV/ML are central (BRD §§9, 11). PostgreSQL is the first relational candidate; Django/MySQL remain BRD alternatives. Approve framework, migrations and backup approach explicitly. | M1 onward |
| D2 | File/vector storage and durable jobs | Choose private persistent file storage, a persistent vector option from the BRD's FAISS/Chroma/Qdrant candidates, and a restart-safe worker/job mechanism. Evaluate persistence/restore, ACL filtering, deployment complexity and actual Render resource needs. Do not add Redis, a broker or multiple services merely by default. | M2–M7 |
| D3 | Model and privacy policy | Decide hosted versus local execution for generation, text/image embeddings and transcription; select concrete adapters only after a representative quality/resource trial. Keep opaque model IDs in the frontend and credentials in private server configuration. Approve whether personal content may leave the deployment and provider retention/logging terms. | Quality trials and M3–M7 |
| D4 | Identity/email verification | Decide account activation, email-change verification, invitation identity proof, email delivery and private Admin provisioning. Recommend verification before issuing a usable authenticated account session, consistent with the handoff; add honest pending-verification UX/contract states rather than fake login success. | M1, M8 |
| D5 | Study-time measurement | Choose an explicit consent-based method. Recommend **user-controlled study sessions** with defined start/stop/pause and crash recovery, not time inferred from page views or document counts. This entails a small, approved UI/API addition. Another genuine measurement source is possible if specified. | M9 |
| D6 | Practical acceptance envelope | Confirm budget, available development time, target browsers/devices, representative corpus size, recording/file limits, language coverage, latency/quality targets and recovery expectations. English is the BRD primary OCR language; do not infer Hindi or another required language from location. | Estimates, model/storage selection, M10 |

### Contract checkpoints exposed by actual files

These are integration issues to resolve, not permission to silently change the contract now.

1. **Verification states:** `POST /auth/register` currently returns a `Session`; `Login.tsx` navigates after `auth.accept` produces a user. `User` has no verification-state field, and there is no verification-completion API in the current operation set. Similarly, `Settings.tsx` expects a canonical saved profile immediately. A pending registration/email change needs agreed response semantics, safe confirmation/resend behavior and user feedback. A typed `user:null` response alone is not a complete pending-verification experience. Preserve the restored Login presentation during this addition.
2. **Measured analytics:** `Analytics.studyMinutes` can honestly be null and `Dashboard.tsx` says “Not measured,” but there is no study-session collection API/UI. That is a correct interim state, **not completion of the mandatory study-time feature**. Approve measurement and provenance before final analytics acceptance.
3. **Revocable files:** the handoff requires immediate revocation for new requests, while the document contract permits short-lived signed URLs. An ordinary already-issued storage URL can remain valid until expiry. Recommend a **session-authorized file gateway** (or equally revocable access mechanism) for shared sources. URL expiry alone must not be described as immediate revocation. Previously downloaded/displayed copies cannot be recalled.
4. **Query response timing:** `api/client.ts` aborts at 45 seconds, while `/assistant/query` returns a synchronous `Answer`, not a polling job/stream. Benchmark against both the client deadline and the real hosting/proxy limits. If supported workloads cannot fit safely, agree an asynchronous/streaming contract and matching UI tests first; do not silently return a `Job` where `Answer` is expected or merely remove timeouts.
5. **Private artifact operations:** `FileSource.url` is present, but the chosen file-serving authorization mechanism is not an implemented operation. Specify file/thumbnail access, expiry/refresh, content headers and revocation tests. Corrections also need explicit reindexing consistency: stale text must not survive as authoritative retrieval evidence after a committed correction.

Keep DTOs, operation definitions, generated OpenAPI, fixtures and handoff synchronized for every approved change. `contract:check` only detects generation drift; it is not proof that a real backend conforms. Backend-only internal model/job metadata need not leak into frontend DTOs.

## 3. Architecture and sequencing principles

**Proposed shape:** retain the React SPA; use one modular API codebase and a durable processing worker, with relational metadata, private artifacts and a persistent retrieval index. Modules need clear boundaries, not a microservice fleet. API and worker may share a codebase while running separately so OCR/model workloads do not block interactive requests.

- Establish ownership/ACL checks in the data model and query layer **before** ingestion and retrieval. M8 completes sharing behavior; it does not retrofit security into an already public corpus.
- Persist users/sessions, settings/configuration, documents/artifacts/versions, jobs/items/idempotency records, tasks, meetings, grants/invitations, conversations/messages/evidence and measurement events as needed. These are proposed internal entities, not an approved schema yet.
- Persist a document/job before reporting its durable creation. Use bounded retries, item-level progress and restart recovery. A process-local background promise is not a durable queue.
- Preserve originals and associate processed images, OCR/transcripts, chunks, page/region metadata and index/model versions. Corrections invalidate/rebuild affected retrieval representations without claiming model retraining.
- Separate model adapters for extraction/classification, embeddings, transcription and generation. A model setting does not make incompatible embedding spaces interchangeable; embedding changes require versioned indexes and a controlled rebuild.
- Keep provider requests bounded and confidential. Never place provider/storage/database secrets in `VITE_*`, browser bundles, application logs or this document.
- Keep existing visuals and stack; change frontend behavior only when real integration needs an approved state or correction. No design replacement is part of backend integration.

### Dependency map

```text
M0 decisions and contract review
 └─ M1 identity, persistence, permissions, settings/Admin
     └─ M2 durable ingestion, OpenCV/OCR, sources, library/timeline
         ├─ M3 classification/topics/action tasks
         └─ M4 authorized text RAG (correction integration needs M3)
             ├─ M5 meeting summaries/decisions/tasks (also M3)
             └─ M7 multimodal RAG (also M2 image provenance)
         └─ M6 audio transcription (M3–M5 consume transcripts)
     └─ M8 sharing/invitations (foundation M1; final tests need M2/M4)
M2 + M3 + approved measurement → M9 analytics
M1–M9 complete + separate deployment approval → M10 release validation
```

A sensible single-developer order is **M0 → M1 → M2 → M3 → M4 → M5 → M6 → M7 → M8 → M9 → M10**. Collection of evaluation examples and ACL test design start at M0/M1, not at the end. Audio adapters, sharing operations and measurement can be developed earlier once their listed dependencies are ready; their **end-to-end acceptance** still includes the dependent flows.

All milestones below are mandatory. None is an MVP exit or a release that drops later features.

## 4. Milestones and acceptance gates

### M0 — Approved design and evaluation baseline

**Depends on:** this roadmap review. **Relative effort:** Small, with potentially substantial waiting for decisions.

Deliver an approved decision record for D1–D6, contract deltas, data/ACL model, service/resource plan and a private representative evaluation set. Define measurable quality/latency targets before tuning against results. Include clean/poor scans, English handwritten and printed notes, slides/whiteboards, PDF/DOCX/text, meeting examples, audio, image-dependent questions, irrelevant queries and adversarial/revoked-source cases.

**Exit gate:** owner approves choices and the next implementation scope. No framework/provider has been selected merely because it appears in this roadmap.

### M1 — Trusted service foundation

**Depends on:** M0. **Relative effort:** Large.

Implement migrations, durable users/sessions, password handling, anonymous-session CSRF bootstrap, authentication/logout, email-control flow, private Admin provisioning, settings/onboarding, capabilities, Admin configuration/status and shared authorization helpers. Establish document ownership/grant primitives now. Use safe JSON errors, request IDs, schema validation, authentication/expensive-operation limits and privacy-safe logs.

**Exit gate:** real registration/verification/login/logout/password/profile flows persist across reload and restart. Test expired sessions, rejected/missing CSRF, incorrect Origin, attempts to self-assign Admin and direct non-Admin API calls. Capabilities describe only configured functionality; Admin output contains no provider secrets or other users' content. Schema migrations and a basic restore exercise work.

**Files/contracts:** `auth/*`, `pages/{Login,Settings,Onboarding,Admin}.tsx`; `/session`, `/auth/*`, `/settings`, `/onboarding`, `/capabilities`, `/admin/*`. **Authority:** BRD §§5, 7.8, 8.3–8.4; mandatory Admin clarification.

### M2 — Real capture-to-library processing

**Depends on:** M1 and approved storage/job choices. **Relative effort:** Large.

Implement file/text/camera batch intake; signature/size/page/pixel/quota checks and safe parsing; original storage; OpenCV boundary/region detection, perspective correction and enhancement; OCR and digital PDF/DOCX/plain-text extraction; processed image/thumbnail storage and source associations. Implement durable jobs, item-level failures, retry/cancel/idempotency, document read/correction foundations, indexed text search/filter/pagination and timezone-aware timeline events.

**Exit gate:** capture → job → original/processed source → editable extracted text → library/timeline works against the service, survives restart and enforces ownership. A mixed valid/corrupt batch reports partial results. Same-key retries do not duplicate artifacts; mismatched payloads reject; cancellation retains completed results. Unsupported/malformed files fail safely without exhausting worker resources. No-boundary/poor-image outcomes are explicit rather than false successful preprocessing.

**Files/contracts:** `pages/{Capture,Processing,DocumentDetail,Library,Timeline}.tsx`, `components/ui/MediaCapture.tsx`; `/ingestions`, `/jobs/*`, `/documents*`, `/timeline`. **Authority:** BRD §§6.1–6.2, 6.5, 7.1–7.3, 7.7, 10.1–10.2.

### M3 — Classification, topics and actionable tasks

**Depends on:** M2. **Relative effort:** Medium–Large.

Implement actual ML-based document classification, topic detection/clustering and action-item detection; not static labels or only fabricated examples. Persist user corrections and idempotent source-linked task extraction. Support task create/edit/delete/complete/reopen, priorities/due dates and owner/source filters. Maintain index invalidation and timeline consistency on corrections.

**Exit gate:** evaluate classification/topic quality and action-item precision/recall on labeled held-out examples. Retrying extraction does not recreate tasks or overwrite intentional user edits. Document/meeting sources and calendar due dates survive reload. A personal task does not grant access to a revoked source. Correction and reindex behavior is observable/tested without claiming retraining.

**Files/contracts:** `pages/{DocumentDetail,Tasks}.tsx`, `/documents/{id}`, `/tasks*`, job processing. **Authority:** BRD §§7.4–7.5, 10.4, 13.

### M4 — Grounded text retrieval and saved conversations

**Depends on:** M2; integrate M3 corrections before acceptance. **Relative effort:** Large.

Implement chunk/page/source provenance, compatible embedding/index versions, semantic retrieval, bounded prompts, generation, evidence and insufficient-evidence responses. Enforce ACLs and selected-document restrictions before provider context construction and again before returning/persisting results if access changes mid-request. Persist message pairs atomically and honor actor/request-bound idempotency. Treat retrieved instructions as untrusted content, not authority to call tools or disclose data.

**Exit gate:** answerable questions cite accessible supporting content; unsupported questions abstain. Check relevant-source retrieval, groundedness, citation correctness, saved-history reload and timeout/retry behavior. An unrelated user's text cannot influence an answer or appear in snippets, totals, errors or cached results. Source corrections and changed permissions are respected on new queries and history reads. Measure the complete response path against the agreed latency budget and 45-second client constraint.

**Files/contracts:** `pages/Assistant.tsx`, `/assistant/query`, `/conversations*`, `Source`/`Answer` DTOs. **Authority:** BRD §§6.3, 7.6, 9.2, 10.3, 13.

### M5 — Complete meeting workflow

**Depends on:** M2, M3, M4 generation/provenance foundations. **Relative effort:** Medium.

Group owned artifacts by session label/time/ID. Produce grounded summaries and key decisions, source-linked tasks and a resumable summary job. Sharing one artifact must not expose its meeting, other artifacts or someone else's tasks.

**Exit gate:** a real screenshot/whiteboard batch becomes a meeting with all artifacts, grounded decisions and deduplicated tasks. Re-summarization handles corrected input without accumulating duplicate tasks; empty/failed/partial meetings remain understandable. The “What did we decide?” workflow uses actual meeting evidence.

**Files/contracts:** `pages/Meetings.tsx`, meeting-aware Capture/Processing, `/meetings*`. **Authority:** BRD §§6.2, 10.2; not a stretch goal despite §12's original wording.

### M6 — Audio transcription integrated end to end

**Depends on:** M2 jobs/storage; M3–M5 for transcript consumption. **Relative effort:** Medium–Large.

Implement the approved transcription adapter and real accepted audio formats/recording limits. Preserve the original recording, reviewed transcript and meeting association. Feed transcripts into the same classification, task and retrieval paths instead of building a disconnected voice demo. Include provider timeout/failure, long-recording resource limits and recording-consent guidance.

**Exit gate:** physical microphone capture and uploaded audio both yield persisted, editable transcripts; meeting summaries/tasks and RAG can use them. Measure transcription quality on agreed examples. Permission denial, unsupported codecs, interruption, retry and resource cleanup behave correctly on target devices. Advertise transcription capability only when actually available, but configure and validate it before complete-product release.

**Files/contracts:** `components/ui/MediaCapture.tsx`, Capture/Processing/DocumentDetail, ingestion `sourceType: audio` and capabilities. **Authority:** BRD §§4.2, 14, explicitly mandatory.

### M7 — Actual multimodal retrieval

**Depends on:** M2 image/page provenance, M4 retrieval and approved image/text model strategy. **Relative effort:** Large; highest model uncertainty.

Implement image embeddings and their compatible retrieval strategy alongside text. Store image/page/region associations, support image-query context and return real evidence regions where applicable. OCR text alone is not completion of the BRD's image-embedding extension. Keep adapters/model/index versions replaceable without leaking provider-specific types into the UI.

**Exit gate:** image-dependent evaluation questions retrieve the right source even when OCR alone is insufficient; combined text/image context is grounded and permission-filtered. Validate normalized `[x,y,width,height]` regions and page references against the stored source. Unsupported/weak evidence abstains honestly. Measure resource use and query latency, including image upload. Current UI shows region coordinates and a source link; do not claim an interactive region-overlay viewer that does not exist.

**Files/contracts:** Assistant/DocumentDetail, `Source.region`, multipart `/assistant/query`, `capabilities.multimodal`. **Authority:** BRD §§4.2, 14, explicitly mandatory.

### M8 — Selected-document sharing and revocation

**Depends on:** M1 identity/ACL foundation, M2 sources, M4 retrieval/history; recheck M6/M7 artifacts. **Relative effort:** Medium–Large.

Complete owner invitation/grant/change/revoke, verified-recipient accept/decline and view/edit enforcement. Normalize identity, reject self/duplicate grants, handle expired/revoked invitations and keep pending content private. Edit includes text/metadata correction, not reshare or grant management. Use the M0-approved revocable source-access design.

**Exit gate:** test two real users plus an outsider and Admin. View cannot edit; edit cannot reshare; only the owner manages grants. Revoke and downgrade during active sessions/queries: new document/file/thumbnail requests, retrieval, tasks, timeline and history no longer disclose forbidden content. Redact or withhold cached answer text derived from revoked evidence—not just its citation link. Meeting siblings and private tasks are never implicitly shared. Previously obtained copies are explicitly outside recall guarantees.

**Files/contracts:** `components/ui/DocumentShares.tsx`, `pages/Sharing.tsx`, Library, `/documents/{id}/shares*`, `/invitations*`. **Authority:** BRD §14 plus the explicit selected-document clarification; security §8.3.

### M9 — Measured personal analytics

**Depends on:** M2 document events, M3 task events and D5 measurement approval; finalize with M8 ACL semantics. **Relative effort:** Medium.

Implement current personal counts, period activity, tagged-document topic coverage and the approved actual study-time collection. Define timezone/day boundaries, task reopen/recomplete counting, missing measurements and session recovery. Topic coverage means document coverage, not inferred mastery. Do not add hidden tracking.

**Exit gate:** independently recompute 7/30/90-day metrics from known persisted events and compare with the dashboard. Validate duplicate/retried events, clock/day boundaries, permission changes and empty periods. Study time has a documented source and usable recording workflow; “Not measured” remains correct for missing data but does not replace implementing collection.

**Files/contracts:** Dashboard, `/analytics`, `Analytics`; approved collection UI/API additions required. **Authority:** BRD §14 and success/usability metrics §§8.4, 13.

### M10 — Full-stack acceptance and approved release

**Depends on:** every M1–M9 exit gate and separate permission to deploy. **Relative effort:** Large; not a final-day smoke test.

Connect the real Render service/worker and persistent stores; configure private secrets and exact allowed origins. On Netlify, **replace** the deliberate `/api/*` 503 fallback with the actual HTTPS reverse proxy before the SPA rewrite. Preserve `/api/v1`, host-only secure session cookies, CSRF and `private, no-store` private responses. Run controlled staging checks early after M1 if separately authorized; final acceptance still waits for all features.

**Exit gate:** all acceptance items in §7 pass against the deployed stack, backups restore, rollback is rehearsed, and the owner approves release. No backend/API response is faked to pass UI tests. A local HTTP 200 or sandbox preview is not proof of external deployment reachability.

**Files:** `netlify.toml`, `.env.example`, `.github/workflows/frontend.yml`, handoff, new approved backend deployment configuration. **Authority:** BRD §§8–13 and Netlify/Render decision.

## 5. Effort and scheduling

Small/Medium/Large above are **relative planning sizes**, not dates or promises. A calendar forecast would be misleading before D6 establishes availability, budget and a target date, and before OCR/multimodal trials establish feasibility on the chosen hardware.

After M0:

- Split each milestone into implementation, contract/integration tests, evaluation and recovery/documentation tasks. Include follow-up frontend changes explicitly rather than pretending the current contract is immutable.
- Estimate a range for each work package using the actual developer's available hours. Reforecast after M2's first complete processing path and M4's first real retrieval evaluation.
- Reserve explicit contingency for poor-image OCR, model/API latency, multimodal indexing and deployment cookie/file behavior. Do not turn schedule pressure into removal of mandatory features.
- Track progress by exit evidence: “UI exists,” “adapter returns sample text” and “endpoint returns 200” are not completion criteria.

The likely long path is trusted persistence → durable source processing → retrieval/provenance → multimodal quality → full-stack release. Audio, sharing and measurement can become the critical path if their approval/integration work is postponed. Start their design decisions at M0 even when implementation comes later.

## 6. Risk register

Likelihood/impact are planning judgments, not measured failure probabilities. The owner approves product/provider tradeoffs; the implementer supplies mitigation and test evidence (one person may perform both roles).

| Risk | Likelihood / impact | Mitigation and release evidence | Gate |
|---|---|---|---|
| Poor handwriting/blur/lighting reduces OCR | High / High | Representative scans, OpenCV preprocessing, source comparison, retake/correction path; record OCR error and extraction success by input class | M2, M10 |
| Unbounded file/audio processing or restart loses work | Medium / High | Signature/pixel/page/duration/size limits, safe parsers, bounded worker concurrency, durable leases/retries and crash-recovery tests | M2, M6 |
| Duplicate artifacts/tasks/messages after timeout | Medium / High | Actor/operation/payload-bound idempotency, transactional state and task deduplication; concurrent retry and restart tests | M2–M5 |
| Wrong classification/tasks or unsupported answers | High / High | Held-out labels, extraction precision/recall, source-grounded answer rubric, insufficient-evidence behavior and correction | M3–M7 |
| Embedding changes mix incompatible indexes | Medium / High | Version model/dimensions/preprocessing and chunks; controlled reindex/switch/rollback; correction freshness tests | M3, M4, M7 |
| Sharing exposes files, snippets or old answers | Medium / Critical | ACL checks at every read/retrieval/output, revocable file access, source-aware history/cache invalidation and multi-user adversarial tests | M1, M4, M8 |
| Unverified email claims or incorrect session proxying | Medium / Critical | Verified identities, non-self-service Admin, session/CSRF rotation, exact origins; real proxy cookie tests | M1, M8, M10 |
| Source prompt injection/privacy leakage | Medium / High | Untrusted-source boundaries, no tool execution from retrieved instructions, minimum provider context, no confidential logging, review provider policy | M4, M7 |
| Provider latency/cost or unavailable model | High / High | Trial against workload, bounded context/quotas/timeouts, genuine capability/status errors, agreed spending cap; validate sync response budget | M0, M4, M6–M7 |
| Persistent storage/service resources unsuitable for hosting | Medium / High | Verify current hosting limits/prices before purchase, separate durable data from transient runtime files, backup/restore and worker sizing trial | M0, M2, M10 |
| Analytics fabricate study time or double-count events | Medium / High | Consent-based actual measurement, event provenance, defined counting/timezone rules and independent aggregation checks | M9 |
| Integration changes strip visuals or break accessibility | Medium / High | Preserve Login graphics/hover/flip and static fallbacks; retain existing tests and add real-state/device/manual keyboard/screen-reader checks | Every UI change, M10 |
| Single-developer complexity expands scope or hides incomplete features | High / High | Modular service, gated sequence, visible blockers and re-estimation; no enterprise additions and no silent mandatory-feature cuts | All |

No current hosting price, quota, free-tier persistence behavior, provider retention guarantee or service SLA was externally verified during this phase. Validate those facts when choosing services rather than relying on an assumed free deployment.

## 7. Verification plan and definition of complete

### Layered evidence

1. **Preserve frontend regression gates:** build, strict lint, test types, unit/browser/axe tests, deterministic contract check and point-in-time dependency audit. Keep original visual-restoration coverage. Address a dependency advisory according to real impact; do not hide it by changing thresholds.
2. **Add backend unit/integration gates:** validation, migrations, transactions, sessions/CSRF/roles, ACLs, job recovery/idempotency, correction/reindexing, error envelopes and aggregation. Choose backend test tooling with the approved stack.
3. **Real contract conformance:** exercise every implemented operation against OpenAPI and descriptions, including error responses, multipart, nulls, pagination, dates, permissions and configured capabilities. No reliance on TypeScript assertions for runtime validation.
4. **Real browser-to-service workflows:** retain fixture tests for deterministic failures but add a separate integration suite without HTTP interception. Use non-sensitive seed data and verified identities. Verify persistence after reload/restart and cross-user denial.
5. **ML/CV evaluation:** keep private/versioned evaluation data outside Git by default; retain non-sensitive rubric/results and model/index versions. Separate tuning examples from held-out evaluation, and record actual failures instead of selecting only favorable demos.
6. **Deployment/device acceptance:** actual HTTPS origins, API routing/cookies/CSRF/private caching, upload/response limits, physical camera/microphone, target-browser layouts, manual keyboard/screen-reader paths, reduced motion, missing WebGL and recovery.

### Metrics derived from BRD §§8 and 13

| Measure | Required evidence; numeric threshold approved at M0 |
|---|---|
| Ingestion/searchability | Successful and failed items by format, restart/partial-failure outcomes, persisted and findable source associations |
| OCR/transcription | Character/word error rates on labeled samples, separated by input/language/quality class; transcription is required by the scope clarification |
| Classification/topics | Per-class results and aggregate accuracy/F1 where appropriate; human relevance rubric for topic labels/clusters |
| Action items | Precision/recall/F1 on labeled actions plus source correctness and duplicate rate |
| Retrieval and answers | Relevant-source recall at selected k, groundedness/citation rubric, correct abstention and text/image-specific cases |
| Privacy/authorization | All defined negative-access tests pass; no observed cross-user or revoked-source disclosure in the test matrix |
| Performance/scale | End-to-end p50/p95 latency, queue delay and processing time, workload/hardware/model/ cold-start conditions, resource/cost data; test a representative thousands-of-documents corpus for §8.2 |
| Usability | Successful first capture/review/question and task completion, manual accessibility findings, owner feedback and responsive-device evidence |

The BRD's “few seconds” performance language is an objective, not an established SLA. Agree concrete workload-specific budgets before acceptance. Do not replace evaluation with a claimed accuracy percentage that has not been measured.

### Complete-product release checklist

- [ ] All M1–M9 exit gates passed, including Admin, audio, image-embedding multimodal RAG, selected-document sharing and genuine study-time collection.
- [ ] All four BRD §10 workflows work with real persisted data; library/timeline/settings/onboarding and §14 workflows also pass.
- [ ] Approved pending-verification and measurement contract/UI changes are documented and tested; no known integration blocker is called “frontend complete” to ignore it.
- [ ] Unauthorized access tests cover API, files/thumbnails, jobs, retrieval, history, tasks and meeting boundaries, including revocation during an in-flight request.
- [ ] Model evaluation and realistic performance/scale reports meet pre-agreed thresholds; errors, weak evidence and unavailable providers remain honest.
- [ ] Public deployment checks verify deep links, API errors as JSON, HTTPS, exact origins, cookies/CSRF, private cache controls and source expiry/revocation.
- [ ] Backup restore and rollback recover metadata/artifact associations; vector indexes can be restored or rebuilt from known versions without losing sources. Restarted workers recover safely.
- [ ] Secrets are private; logs exclude confidential prompts/documents/passwords/tokens; spending and resource limits are configured and observed.
- [ ] Existing visuals remain intact; manual keyboard/screen-reader, target-browser and physical media tests are completed. No accessibility certification is inferred from axe alone.
- [ ] Actual remote CI and release evidence are recorded separately from local test results; owner approves release/deployment explicitly.

## 8. Handoff and next approval

**Phase 5 planning is complete. No application/backend code, dependency, API schema or deployment configuration changed in this phase.** Documentation records the roadmap and reconciles stale baseline descriptions. No commit/push was made for this planning deliverable; earlier publication approval covered Phase 4 and its Login correction.

Next recommended action: review this roadmap and resolve **D1–D6 at M0**, then explicitly authorize the selected implementation milestone. Starting M0 implementation decisions does not require choosing every provider in a single chat, but unresolved dependencies must remain visible. Do not infer permission to start backend development, purchase services, deploy, merge to main or publish new work from approval to plan.
