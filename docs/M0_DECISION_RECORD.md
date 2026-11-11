# M0 — Final decision record and evaluation baseline

**Date:** 10 November 2026  
**Status:** Closed. These are the owner's decisions, not measurements and not implemented code.  
**Supersedes:** the open choices in `docs/M0_DECISION_PROPOSAL.md` and `docs/M0_FREE_TIER_FEASIBILITY.md`. Those documents remain the proposal and the limit evidence. This record is the authority for what was approved.

Milestone M0 is complete as a decision gate. No backend package was installed, no provider account was created, no sample was sent to Google or Groq, and no existing frontend contract was edited. Completing M0 does not authorize Milestone M1, deployment, or a merge to `main`.

## 1. Decisions

| ID | Approved choice |
|---|---|
| D1 | One Python service: FastAPI, Pydantic, SQLAlchemy, and Alembic. It runs as a single Render free web service, 512 MB RAM and less than 1 CPU. There is no separate paid worker. |
| D2 | Cloudflare R2 Standard for private files. Neon Free PostgreSQL for application data, jobs, and pgvector. Qdrant Cloud's free cluster is only an overflow fallback if a measured index would pass 700 MB of Neon's 1 GB cap. |
| D3 | Local OpenCV for page geometry and contrast. Gemini free tier for transcription, embeddings, generation, and selected-image questions. Groq free Whisper for audio. Details and limits are in §3. |
| D4 | Email verification is required before a usable session. Local development and free staging print the activation link to the server log. No paid domain or email provider is assumed. |
| D5 | Study time is an explicit Start / Pause / Resume / Stop timer. The server records confirmed intervals. Page views are not study time. |
| D6 | Monthly spend ceiling is **$0**. Presigned R2 uploads and asynchronous assistant polling are required. A quota or timeout failure stops the operation. It never attaches a card or falls through to a paid rate. |

The earlier $100/month Render worker and database recommendation is withdrawn. Render's free Postgres is rejected because it expires 30 days after creation and is then deleted. Hugging Face Docker or Gradio Spaces are not the host: creating them requires a paid plan.

pgvector is an approved addition to the BRD's named indicative stores (FAISS, Chroma, Qdrant). Qdrant remains available only as the overflow fallback above.

## 2. Accepted free-tier limits

The owner accepted the trade-offs documented on 10 November 2026. They are constraints, not defects to be silently worked around.

- Render free web sleeps after 15 minutes without inbound traffic and takes about one minute to wake. Local files are lost on sleep, restart, or redeploy. A workspace has 750 free instance hours per month. Included Hobby bandwidth is 5 GB; without a payment method, excess bandwidth suspends free services. [Render free](https://render.com/docs/free) [Render pricing](https://render.com/pricing)
- Neon Free allows 1 GB per project and 100 CU-hours per project per month. Compute scales to zero after 5 minutes and that behavior cannot be disabled. History is 6 hours, not 24. Exceeding the cap stops writes or compute; it does not bill an overage. [Neon plans](https://neon.com/docs/introduction/plans)
- R2 Standard's free allowance is 10 GB-month, 1 million Class A operations, and 10 million Class B operations. R2 egress is free. Infrequent Access is not in the free allowance. [R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- Netlify's external proxy times out at 26 seconds. The credit-based Free plan has 300 credits per month and no auto-recharge. [Netlify proxy](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/) [Netlify credits](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/)
- This stack cannot claim always-on processing, a tested 3,000-document corpus, warm few-second answers after idle, a 24-hour recovery point, or production email delivery.

Application hard caps, below the vendor allowances: 8 GB stored in R2, 800,000 Class A and 8 million Class B operations per month, 4 GB Render egress per month, and 200 Netlify credits kept for deploys and ordinary traffic. Stop before the cap.

## 3. Model and privacy policy

### Data that may leave the app

Accepted for personal and academic prototype evaluation, using **non-sensitive test documents and synthetic data only**:

- Google's free-tier term that submitted content may be used to improve Google's products. [Gemini pricing](https://aistudio.google.com/docs/pricing)
- Text chunks may be sent to Google's free embedding API. Vectors are stored in Neon pgvector.
- Preprocessed page images may be sent to Gemini for transcription, including handwriting. This is in addition to the earlier consent for query images.
- Selected excerpts, retrieved page images, and questions may be sent to Gemini for grounded answers.
- Audio segments may be sent to Groq for transcription.

Real private material is not approved for these calls. No sample has been sent.

### Pinned adapters

| Function | Approved adapter | Rule |
|---|---|---|
| Page geometry | Local OpenCV on the Render service | Boundary detection, perspective correction, and contrast enhancement only. One page at a time. Reject decompression bombs. Cap decoded input at 20 megapixels and the processed image at about 8 megapixels. |
| Transcription of printed and handwritten pages | Current free Gemini Flash vision model | The owner's cited requirement is accurate capture of handwritten notes. Tesseract is not the approved transcription engine. The exact Flash model ID is read from the project's AI Studio free-tier list at implementation time and then pinned. Gemini 1.5 Flash is not that pin. Gemini 4 models are not free. |
| Text embeddings | `gemini-embedding-001` | The example `text-embedding-004` was shut down on 14 January 2026. Its listed replacement is `gemini-embedding-2`; `gemini-embedding-001` remains available until 14 May 2028 and has separate document and query task types. [Deprecations](https://ai.google.dev/gemini-api/docs/deprecations) [Embedding model](https://ai.google.dev/gemini-api/docs/models/gemini-embedding-001) |
| Generation and image questions | Same pinned free Gemini Flash model | Send the question, authorized excerpts, limited conversation context, and the retrieved page image. Do not send the whole library. Do not enable Google Search grounding. |
| Audio | Groq `whisper-large-v3-turbo` if the free account lists it; otherwise `whisper-large-v3` | Enable Zero Data Retention before the first recording. Each request must be under the documented 25 MB free-tier file cap. Stop on HTTP 429. Do not use the paid per-hour rate. [Groq speech-to-text](https://console.groq.com/docs/speech-to-text) [Groq data](https://console.groq.com/docs/your-data) |

Embedding rules:

- Store 768-dimensional vectors, one of Google's recommended sizes. A move to 1536 or 3072 is a new index version and is allowed only if the measured index stays under 700 MB.
- Embed documents with task type `RETRIEVAL_DOCUMENT` and queries with `RETRIEVAL_QUERY`. Do not mix those vectors with another model's vectors.
- Embed one chunk per request. The batch embedding API is not in the fetched free-tier price column and is not approved.
- Chunk on page and region boundaries. Keep the source page, region, model ID, task type, and dimension with every vector.
- If `gemini-embedding-001` is unavailable on the free project, stop and switch only to `gemini-embedding-2` as a new index version, using its documented text retrieval prefix. Do not revive `text-embedding-004`.
- Page images are not sent to the embedding model under this decision. A separate visual-vector index is not approved. Image-dependent questions use semantic search over the transcribed text, then send the retrieved page image to Gemini. If that cannot find the page, report the miss. Do not add image embeddings without a new decision.

Groq may still retain inputs and outputs for up to 30 days for reliability or abuse investigation unless Zero Data Retention is enabled. Retained data is stored in the United States. If ZDR cannot be enabled on the free account, do not send recordings.

## 4. Runtime behavior required by these decisions

These semantics are approved for a later contract change. They are not present in `docs/openapi.json` or `frontend/src/api/types.ts`.

### Jobs and assistant calls

- Persist every job in Postgres before acknowledging it. In-memory background tasks are not durable: Render may restart or sleep the free service at any time.
- Each authenticated poll may run one unit expected to finish in under 15 seconds: one preprocessed page, one Gemini transcription, one embedding batch of a single chunk, or one Groq segment. The poll returns the checkpoint.
- If the service is asleep, the job stays queued and resumes on the next visit. The interface must say that. It must not show a completed OCR result or answer that was not stored.
- `POST /assistant/query` becomes a short `202` with a query ID, followed by status polling and cancellation. A lost acknowledgement is recovered by the idempotency key, not by submitting the work twice. Streaming is not the approved path; one proxied stream can still be cut at 26 seconds.
- Re-check authorization before a provider call and before returning a stored answer.

### Files

- Large uploads use a scoped presigned R2 write into quarantine, then an authenticated completion check. A write grant is not permission to read the object.
- Reads use an authorization check and a signed URL that expires in 60 seconds. Revocation stops new URLs immediately. A URL already issued cannot be recalled. Downloaded copies cannot be recalled. This is the accepted $0 substitute for a bandwidth-heavy file gateway.

### Identity

- Registration does not create a usable authenticated user. It acknowledges a pending verification without revealing whether the address already exists.
- The confirmation request requires the token and the signup password. A link preview must not activate the account. Confirmation leads to sign-in; it does not silently create a session.
- Correct credentials for an unverified account return `EMAIL_VERIFICATION_REQUIRED`.
- An email change is not part of ordinary settings save. The old verified address remains current until the new address is confirmed.
- In local development and free staging, the message is written to the server log and is not emailed. Those logs must not be copied into analytics or published samples.
- Production email remains blocked until a $0 sending path exists. That does not remove the verification state machine.

### Study time

- One open session per user. The client cannot submit elapsed time.
- Heartbeat every 30 seconds. If no valid heartbeat arrives within 90 seconds, pause at the last confirmed server time. Do not credit the gap.
- An active timer is inbound traffic, so it keeps the free web service awake and consumes free hours only while the timer is running.
- A cold wake must not be presented as running study time. The display catches up only to the server's confirmed intervals.
- Aggregates use stored UTC intervals split on the requested IANA timezone day. No measurement remains null, not zero.

## 5. Approved evaluation baseline

This is the measurement plan. It has not been collected or executed. Run it only after implementation is separately authorized. Use owner-consented, non-sensitive, or synthetic samples. Do not commit them.

### Corpus

| Set | Size | Stop |
|---|---|---|
| Accounts | 1 owner, 1 viewer, 1 outsider | No load test beyond 3 browsers |
| Documents | 30 mixed files, including one multi-page PDF and one DOCX | Stop before 8 GB R2 or 700 MB Neon |
| OCR pages | 12: 4 clean printed, 4 handwritten, 4 degraded | One page in flight; stop if the 512 MB service is killed |
| Tasks and meetings | 40 labeled passages and 3 short meeting notes | Label by hand. Do not spend Gemini calls on labeling |
| Audio | 3 English clips, each under 25 MB, together under 15 minutes | Stop if ZDR is unavailable or Groq returns 429 |
| Questions | 24: 12 text-answerable, 6 image-dependent, 6 unanswerable | Stop at 80% of the project's displayed Gemini daily quota |
| Authorization | Owner, viewer, editor, outsider, revoked share, Admin | Local fixtures are enough |
| Timer | Two tabs, reload, 90-second gap, cold wake | Reject any client-supplied duration |

The 3,000-document envelope is outside this baseline. A synthetic size probe may insert metadata until 70% of Neon storage and must then delete it. That probe measures capacity only.

Freeze the 24 questions before prompt tuning. Record the Flash model ID, embedding model ID, dimension, task type, Groq model ID, corpus hash, and the AI Studio quota screen at the start and end.

### How results are judged

Thresholds are **report-only** on this free stack. A miss does not remove a feature and does not authorize paid capacity.

| Measure | Record | Do not claim from this run |
|---|---|---|
| Ingestion | Success or the exact failure code for every fixture | Success at 3,000 documents |
| OCR | Character error rate for printed, handwritten, and degraded pages, including pages that exhausted memory | That handwriting is solved before the numbers exist |
| Transcription | Word error rate for clips Groq accepted | A 60-minute or unlimited-audio workflow |
| Retrieval | Supporting-source recall@5 for `gemini-embedding-001` text search, plus whether the retrieved page was the right image | A native visual-vector index |
| Answers | Share of substantive claims supported by cited evidence, abstention on unanswerable questions, and whether every cited ID was authorized | A 95% release gate |
| Latency | Cold and warm times separately, including queue wait and the one-minute wake | BRD "few seconds" after 15 idle minutes |
| Authorization and timer | Pass or fail for each race | — |
| Cost | Gemini requests, Groq requests, R2 operations, Render egress, Neon CU-hours, Netlify credits | $0 if any meter entered a billable overage |

Also run, once implementation exists and without cloud spend: password and verification transitions, CSRF and origin checks, grant enforcement, job-lease recovery, and timer interval math. Those tests still must not change the published frontend contract until that change is authorized.

## 6. What remains outside M0

- M1 identity, persistence, ACL, settings, and Admin implementation.
- Any edit to `frontend/src/api/types.ts`, `docs/openapi.json`, `docs/BACKEND_HANDOFF.md`, the contract generator, package manifests, or `netlify.toml`.
- Account creation, secret storage, package installation, and provider calls.
- Production email delivery.
- A visual-vector index, unless a later evaluation miss is returned for a new decision.
- Deployment and a merge to `main`.

The next step is an explicit authorization to begin M1. Until then, the frontend continues to report an unavailable API, and the published contract remains the contract.
