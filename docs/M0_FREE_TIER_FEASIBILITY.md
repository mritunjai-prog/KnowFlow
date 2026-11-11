# M0 — Free-tier feasibility and evaluation baseline

**Date:** 10 November 2026  
**Status:** Historical feasibility evidence. The owner accepted these trade-offs and closed the remaining choices in `docs/M0_DECISION_RECORD.md`. This file is not the current decision authority.  
**Supersedes:** the $100/month resource recommendation in `docs/M0_DECISION_PROPOSAL.md`. The earlier D4/D5 draft API shapes were adopted as intended semantics in the decision record; they are still not applied to the frontend contract.

The owner amended M0 to a **strict $0/month ceiling**. Every hosted dependency below must stay inside a permanent free allowance. Exceeding an allowance must stop the operation. It must not attach a card, enable auto-recharge, or fall through to a paid rate.

No backend package was installed. No provider account was created. No document, image, or recording was sent to Google or Groq. `frontend/src/api/types.ts`, `docs/openapi.json`, `docs/BACKEND_HANDOFF.md`, the contract generator, package manifests, and `netlify.toml` were not modified.

## Verdict

A $0 stack can support a **personal functional baseline** of every mandatory feature on a small consented corpus, with cold starts, interrupted processing, and modest retrieval quality.

It **cannot** honestly meet the earlier acceptance envelope or the BRD's "few seconds" and "thousands of documents" expectations:

- always-on processing
- a separate worker
- 3,000 documents / 50,000 chunks / 10,000 visual vectors as a tested load
- warm text-answer p95 of 15 seconds after idle
- reliable handwriting OCR from local models
- 24-hour recovery points and rehearsed backups
- production email verification without a domain

Those gaps are recorded as failed or untested targets. They are not permission to remove Admin, audio, multimodal retrieval, sharing, analytics, or any other BRD feature.

## Owner decisions recorded

| Decision | Adopted amendment | Feasibility disposition |
|---|---|---|
| D1 | One FastAPI service on a free web host; asynchronous work inside that service; no paid worker | Accepted, with the job design below. Hugging Face Docker/Gradio Spaces are not a $0 option for a new account. |
| D2 | Cloudflare R2; pgvector on free Postgres, or Qdrant Cloud free if the database cannot hold the index; database-backed jobs | R2 free tier is real. Prefer Neon Free plus pgvector. Qdrant free is the measured fallback, not a second always-on store. |
| D3 | Local OpenCV and Tesseract; Google Gemini free tier for generation and multimodal questions; Groq free tier for Whisper; consented excerpts, query images, and audio may leave the app | Accepted only inside the privacy and quota limits below. Gemini 1.5 Flash is not the current free candidate. Embeddings and handwriting remain open. |
| D4 | Verification logic remains; local development and free staging print activation links to server logs | Accepted for local/free staging. Production email is still blocked at $0. |
| D5 | Explicit Start/Pause/Resume/Stop timer; server-recorded intervals | Accepted. A sleeping host pauses at the last confirmed heartbeat. It must not invent the missing time. |
| D6 | $0 ceiling; presigned R2 uploads; asynchronous or streaming assistant calls so Netlify's 26-second proxy timeout is not the request path | Async polling is the timeout-safe design. Streaming through the Netlify proxy is not a dependable workaround. |

## Verified limits

Checked 10 November 2026. These are vendor list prices and documented quotas, not an account inspection. No Render, Netlify, Supabase, Neon, Cloudflare, Qdrant, Google, or Groq connector is available in this session.

### Compute

- **Render free web:** spins down after 15 minutes without inbound HTTP or WebSocket traffic and takes about one minute to wake. The filesystem is ephemeral and is lost on redeploy, restart, or spin-down. Free instances cannot attach a disk, scale beyond one instance, run a shell, or run one-off jobs. Render says not to use them for production. A workspace gets 750 free instance hours per month; spun-down time does not consume them. Exceeding included outbound bandwidth suspends free services when no payment method is present. Uncommonly high service-initiated traffic, including calls to an external database, APIs, or object storage, can also suspend a free web service. Free web services cannot send SMTP on ports 25, 465, or 587. [Render free](https://render.com/docs/free)
- **Render Hobby workspace:** $0 plus compute, with 5 GB included bandwidth and then $0.15/GB. The free web compute line is 512 MB RAM and less than 1 CPU. [Render pricing](https://render.com/pricing)
- **Render free Postgres:** one database, 1 GB, no backups, expires 30 days after creation, then a 14-day upgrade grace period, then deletion. This is rejected. [Render free](https://render.com/docs/free)
- **Koyeb free instance:** one web service per organization, 512 MB RAM, 0.1 vCPU, 2 GB SSD, only Frankfurt or Washington, cannot be a worker, cannot use a volume, and scales to zero after one hour without traffic. [Koyeb instances](https://www.koyeb.com/docs/reference/instances) A credit-card requirement appears only in secondary write-ups and is **not** treated as verified.
- **Hugging Face Spaces:** CPU Basic is 2 vCPU, 16 GB RAM, and 50 GB of non-persistent disk at no hourly charge, and it sleeps after 48 hours. Creating a Gradio or Docker Space requires a paid plan. Static Spaces are free. A new free account therefore cannot host this FastAPI service there. [Spaces overview](https://huggingface.co/docs/hub/spaces-overview)

**Compute choice:** one Render free web service. It is the documented no-card option with more CPU than Koyeb's 0.1 vCPU. Koyeb is the fallback only if a free instance can be created without adding a payment method. Do not run both. Do not add a keep-alive ping to defeat sleep; that consumes the 750-hour pool and conflicts with Render's abnormal-traffic rule.

### Database and vectors

- **Neon Free:** $0, 1 GB storage per project, 100 CU-hours per project per month, autoscaling up to 2 CU (about 8 GB RAM) while active, scale-to-zero after 5 minutes that cannot be disabled, 5 GB public network transfer, and 6 hours of restore history capped at 1 GB of changes. Exceeding storage or CU-hours stops the project until space is freed or the next month; Neon does not bill Free-plan overages. pgvector is supported. [Neon plans](https://neon.com/docs/introduction/plans) [Neon pgvector](https://neon.com/docs/ai/ai-concepts)
- **Supabase Free:** $0, 500 MB database, shared CPU and 500 MB RAM, 5 GB egress, 1 GB file storage, and at most two active projects. Free projects are paused after one week of inactivity. There is no automatic backup on this plan. pgvector is supported. [Supabase pricing](https://supabase.com/pricing) [Supabase pgvector](https://supabase.com/docs/guides/database/extensions/pgvector)
- **Qdrant Cloud Free:** single-node cluster, 0.5 vCPU, 1 GB RAM, 4 GB disk, no high availability and no backup/disaster-recovery feature at this tier. Exceeding the limit requires a paid upgrade. [Qdrant pricing](https://qdrant.tech/pricing/)

**Database choice:** Neon Free for application data, jobs, and pgvector. It does not expire after 30 days, it is twice Supabase's free database size, and a sleeping compute resumes on the next query instead of requiring a manual unpause after a week. Supabase remains the fallback if Neon cannot be created without a card or paid compute.

The API must use short-lived database connections and allow Neon to scale to zero. A pool held open by an idle web process can exhaust 100 CU-hours and suspend the database for the rest of the month. One CU-hour is one hour at 1 CU; 100 CU-hours is about 400 hours at 0.25 CU, not a month of always-on larger compute.

**Vector choice:** pgvector in that same Neon database. Do not also run Qdrant unless a measured index, including HNSW and chunk text, would pass 700 MB of the 1 GB cap. At that point move only vector payloads to the Qdrant free cluster and keep ownership, grants, and jobs in Postgres. Two vector stores at once waste the $0 budget and create a consistency problem.

A rough lower bound, not a measurement: 50,000 float32 vectors of 768 dimensions are about 150 MB before the index and text. The old 50,000-chunk envelope might fit, or it might not once OCR text, transcripts, HNSW, and row overhead are included. The free baseline must not assume it fits.

### Files, proxy, and bandwidth

- **Cloudflare R2 Standard free tier:** 10 GB-month, 1 million Class A operations, 10 million Class B operations, and no R2 egress charge. The allowance does not apply to Infrequent Access. Exceeding it is billable. [R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- **Netlify:** external proxy rewrites time out at 26 seconds. The current frontend 45-second client timeout cannot extend that. The credit-based Free plan includes 300 credits per month with a hard limit and no auto-recharge. A production deploy costs 15 credits. Bandwidth costs 20 credits per GB, and web requests cost 2 credits per 10,000. [Netlify proxy](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/) [Netlify credits](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/)
- **Render egress:** 5 GB included. Service-to-R2, service-to-Neon, and service-to-model traffic is service-initiated outbound traffic.

**Hard application caps, below the vendor allowances:** 8 GB stored in R2, 800,000 Class A and 8 million Class B operations per month, 4 GB Render egress per month, and 200 Netlify credits reserved for deploys and ordinary page/API traffic. Caps are enforced before upload or provider calls. They are planning limits, not code yet.

Presigned R2 **writes** are approved and avoid putting large uploads through the 26-second proxy. Reads are the remaining trade-off. Proxying every download through Render and Netlify spends both bandwidth pools. A signed download URL cannot be recalled after it is issued. For this $0 baseline, issue read URLs only after an authorization check, with a proposed 60-second expiry, and never issue a new one after revocation. Bytes already requested cannot be recalled. This is a constrained proposal, not an edit to the current contract.

### Models and privacy

- **Gemini Developer API free tier:** limited model access and free input/output tokens. The pricing page says free-tier content is **used to improve Google's products**. Paid tier content is not. Gemini 4 Carbon and Gemini 4 Argon are not on the free tier. Gemini 3.8 Flash and Gemini 3.6 Flash were listed as free of charge on 10 November 2026, with the same product-improvement disclosure. Exact RPM, TPM, and RPD are project-specific, are not guaranteed, and must be read from the owner's AI Studio rate-limit page before any run. [Gemini pricing](https://aistudio.google.com/docs/pricing) [Gemini rate limits](https://aistudio.google.com/docs/rate-limits)
- **Gemini 1.5 Flash** was not on the fetched current pricing page. Do not pin it. Gemini 2.5 names still appear in batch-quota tables, but that is not evidence that 1.5 or 2.5 is the right free model. At implementation time, select the current free Flash model shown for the project and pin that snapshot only after the baseline.
- **Groq speech-to-text:** the free tier accepts audio files up to 25 MB; the developer tier accepts 100 MB. `whisper-large-v3` and `whisper-large-v3-turbo` have published paid rates of $0.111 and $0.04 per hour. Those rates are a reason to hard-stop, not a fallback. The fetched rate-limit table is described as developer-plan base limits, so it is **not** cited here as the free quota. [Groq speech-to-text](https://console.groq.com/docs/speech-to-text)
- **Groq data:** customer inference data, including `/audio/transcriptions`, is not retained by default. Groq may retain inputs and outputs for up to 30 days for reliability or abuse investigation. Zero Data Retention can be enabled by all customers in Data Controls. Retained customer data is stored in the United States. [Groq data](https://console.groq.com/docs/your-data)

**Privacy gate still open:** the owner allowed selected excerpts, query images, and audio to leave the app. That does **not** yet explicitly accept Google's free-tier term that content is used to improve its products. No Gemini call is authorized until that sentence is accepted or rejected. If it is rejected, free Gemini cannot be used, and this $0 plan has no verified no-training generation substitute.

Groq is different: enable Zero Data Retention before the first recording, do not use batch or fine-tune endpoints, and stop on HTTP 429. Do not send audio if ZDR cannot be enabled on the free account.

### What was not verified

No account quota, region capacity, credit-card wall, or actual cold-start time was measured. Koyeb's card requirement, Gemini's numeric free RPM/RPD, and Groq's free audio-seconds quota are deliberately unmarked. Local OCR memory use on 512 MB was not profiled because no backend packages were installed.

## Architecture that fits the amendment

```text
Browser (Netlify)
  |  short JSON control calls only (<15s target, 26s hard proxy limit)
  |  large bytes go browser -> private R2, not through Netlify
  v
One Render free FastAPI process
  |  claims at most one small job unit per poll while the process is awake
  v
Neon Free Postgres: identity, grants, jobs, metadata, lexical search, pgvector
R2: private originals and derived artifacts
Gemini free Flash: grounded generation and selected-image questions
Groq Whisper: transcription segments under 25 MB, ZDR on
```

### Jobs

`BackgroundTasks` alone are not durable. Render may restart a free service at any time, and spin-down kills in-memory work. Jobs go into Postgres with a lease and a checkpoint. Each authenticated status poll may claim one unit whose work is expected to finish in under 15 seconds: one preprocessed page, one transcription segment, or one provider call. The response returns the checkpoint. The browser polls again. If the service is asleep, the job stays queued and resumes on the next visit.

This undercuts the BRD's typical few-second processing target whenever the service is cold or a document has many pages. The UI must say "queued until the server is awake," not show a fake completed OCR or answer.

### Retrieval

The amended D3 does not name an embedding model. Loading a local embedding model beside FastAPI, OpenCV, and Tesseract on 512 MB is untested and is not assumed. Sending every document chunk to Gemini would index the whole library, which is broader than consent for selected excerpts.

**Baseline retrieval is therefore PostgreSQL lexical search over local OCR and extracted text, plus source citations.** Semantic pgvector search is implemented only after one of these is explicitly chosen:

1. a local embedding model that a later authorized profile proves fits and leaves headroom on the free web instance; or
2. a separate consent to send document chunks, not merely answer excerpts, to a free embedding API.

Image questions use the retrieved page image as a query image to Gemini. That uses the approved query-image consent. It is not a visual vector index and must be reported as such. A visual index remains mandatory in the BRD sense until an approved embedding path exists; this baseline does not call that requirement done.

### OCR and handwriting

OpenCV plus Tesseract, one page at a time, with a decode cap of 20 megapixels and a processing cap of about 8 megapixels, is the only local OCR path that is plausible on 512 MB. It is still unprofiled. Handwriting is not expected to meet the earlier character-error target with Tesseract alone. Local TrOCR is not approved in the $0 amendment and is likely too large for this instance.

Sending page images to Gemini for handwriting OCR would be a new consent, because those images are not "query images." Until that consent exists, handwriting pages are processed locally, their errors are reported, and the feature is not declared complete.

### Audio

Compress or segment recordings so each Groq request is under 25 MB. A 60-minute high-bitrate file will not fit in one free-tier request. Preserve segment offsets. Stop the job on 429 or any response that would require the developer plan. A stopped transcription is an honest failure, not a reason to drop the audio feature.

### Identity

Keep the proposed verification state machine from the M0 proposal: no usable session before proof, hashed single-use tokens, confirmation by explicit POST with the signup password, and generic registration responses. On local and free staging, the message body is written to the server log and is not sent to an email provider. Logs containing links must stay out of shared analytics and must be redacted in any published log sample.

Production verification email remains impossible at $0 without a domain and a free transactional sender. D4 is not production-complete until that exists. Do not weaken production into "log only" by accident.

### Study timer

The approved timer semantics stand: one open session, server timestamps, 30-second heartbeat, 90-second lease, no offline credit, owner deletion, and timezone-split aggregates. Heartbeats are inbound traffic, so an active timer keeps the Render service awake and consumes free hours only while studying. A hidden tab or a cold start can miss the lease; the server then pauses at the last confirmed time. The client must not keep counting during the minute-long wake. Draft routes stay in the proposal document until a later contract change is authorized.

### Assistant transport

`POST /assistant/query` cannot remain a synchronous answer call behind a 26-second proxy. The approved shape is a short 202 acknowledgement, a status poll, and cancellation, with idempotency so a lost acknowledgement is not submitted twice. Streaming is not the baseline. A single proxied stream is still one request and can be cut at 26 seconds. No OpenAPI edit is made for this finding.

## Evaluation baseline

This baseline is a specification. It was not collected or executed. Use owner-consented or suitably licensed, non-sensitive samples only. Do not commit private material.

### What will be measured

| Set | Free-tier size | Stop condition |
|---|---|---|
| Accounts | 1 owner, 1 viewer, 1 outsider | No load test beyond 3 browsers |
| Documents | 30 mixed files, including at least one multi-page PDF and one DOCX | Stop before 8 GB R2 or 700 MB Neon |
| OCR pages | 12: 4 clean printed, 4 handwritten, 4 degraded | One page in flight; stop on memory failure |
| Tasks and meetings | 40 labeled passages and 3 short meeting notes | No provider call for labeling |
| Audio | 3 English clips, each under 25 MB, total under 15 minutes | Stop on Groq 429 or if ZDR is unavailable |
| Questions | 24: 12 text-answerable, 6 image-dependent, 6 unanswerable | Stop when the project's displayed Gemini daily quota reaches 80% |
| Authorization | Owner, viewer, editor, outsider, revoked share, Admin | Local fixtures; no cloud scale required |
| Timer | Two tabs, reload, 90-second gap, cold wake | No client-supplied elapsed time accepted |

The 3,000-document / 50,000-chunk envelope is **not part of this run**. A separate size probe may insert synthetic metadata until 70% of Neon storage and then delete it. That probe measures capacity. It is not a retrieval-quality test.

### How to score it

Use the same metric definitions as the M0 proposal, but mark every threshold **report-only** on free infrastructure. A miss does not remove a feature and does not authorize a paid upgrade.

| Measure | Report | Do not claim |
|---|---|---|
| Ingestion | Success and exact failure code for every fixture file | 98% at 3,000 documents |
| OCR | Character error rate by cohort, plus any page that exhausted memory | Handwriting target met |
| Transcription | Word error rate for the clips that Groq accepted | 60-minute workflow or unlimited audio |
| Retrieval | Supporting-source recall@5 for lexical search, with an ablation note that no visual index was used | Semantic or multimodal recall target met |
| Answers | Cited-claim support, abstention, and whether every cited ID was authorized | 95% as a release gate |
| Latency | Cold and warm times separately, including queue wait | BRD "few seconds" after 15 idle minutes |
| Authorization and timer | Pass/fail of the race matrix | — |
| Cost | Provider requests, R2 operations, Render egress, Neon CU-hours, Netlify credits | $0 if any meter entered billable overage |

Freeze the 24 questions before tuning prompts. Record model ID, Groq model ID, OCR version, corpus hash, and the AI Studio quota screen at the start and end. If Gemini's product-improvement term has not been accepted, skip the answer and image-question rows and report them as blocked, not as failures of the application.

### Local checks that do not need cloud spend

Once implementation is separately authorized, these can run on a developer machine without creating hosted resources: password and verification state transitions, CSRF and origin checks, grant enforcement, job lease recovery, timer interval math, and the draft DTO shapes against fixtures. They still must not modify the published frontend contract until that contract change is approved.

## What this baseline will not prove

- Production readiness. Render explicitly says not to use free instances for production.
- Survival of a month of daily use. Neon CU-hours, Gemini daily quotas, Groq's unpublished free audio quota, R2 operations, and Render's 5 GB can each stop the service without warning.
- Recovery. Neon Free history is 6 hours, not 24. Supabase Free has no automatic backup. R2 free tier is not a backup plan. The earlier RPO of 24 hours and RTO of 4 hours are unmet.
- Region residency. R2 and Groq do not give the residency guarantee this personal project has not actually specified. Do not infer one from the owner's location.

## Remaining choices before any implementation

1. **Gemini training use.** Accept or reject the free-tier term that submitted content may be used to improve Google's products. Rejection blocks hosted generation at $0.
2. **Embeddings.** Accept lexical search as the measured baseline, approve a later local-model profile, or separately consent to embedding the whole library with a free API.
3. **Handwriting.** Accept report-only Tesseract results, or separately consent to sending non-query page images to Gemini.
4. **Host.** Confirm Render free as the single service, or name an existing Koyeb free instance that does not require a new payment method.
5. **Production email.** Remains deferred. Free staging logs are approved and do not close this gap.

Approval of this feasibility note still does not authorize backend code, package installation, account creation, provider calls, contract edits, deployment, or a merge to `main`.
