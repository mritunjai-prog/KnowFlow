# KnowFlow

A personal knowledge and productivity hub for notes, documents, captured images, meeting content and source-grounded questions.

## Authority and current status

The repository's **Business Requirements Document** (`BRD  Intelligent Personal Productivity Hub Using ML, OpenCV, and RAG.pdf`) is the source of truth, supplemented by the owner's explicit decisions. All BRD features—including §14 extensions—are mandatory. This is a personal project, not an enterprise/compliance product.

**Phase 4 implements the API-connected frontend and backend contract.** The backend has not been implemented or deployed. There is no simulated production login, local mock persistence, fake OCR, timer-generated answer, or fabricated analytics. Without the service, the UI reports unavailability. Test fixtures exist only in test files.

Selected-document sharing with view/edit permissions was explicitly chosen after reviewing BRD §14; there are **no shared workspaces**. Detailed roadmap work remains gated on Phase 5 approval.

## Feature coverage

| BRD authority | Implemented frontend | Later backend responsibility |
|---|---|---|
| §§5, 7.8, 8.3 | Login/register, cookie-session bootstrap, logout, protected routes, User/Admin navigation and Admin configuration/health | Identity verification, password hashing, sessions, CSRF, authorization, real service configuration |
| §§7.1–7.3, 10.1 | Batch file/drop intake, camera preview/retake, text/clipboard, metadata, validation, processing status/retry/cancel, original/preprocessed source and extracted-text review | Signature validation, quotas, storage, OpenCV, OCR, jobs and indexed source association |
| §§7.3–7.5, 10.4 | Type/topic/text correction, source-linked task create/edit/delete/complete, priorities/due dates and filters | Classification/topic models, action detection, canonical persistence/reindexing and deduplication |
| §§6.2, 10.2 | Meeting creation, labeled/dated intake, artifact/task links, summary and decisions, summary job action | Grouping, grounded summarization/decisions and extraction |
| §§6.5, 7.7 | Paginated library and timeline; search/topic/type/date filters, shared/owned views, local-time grouping | Authorized indexed search, aggregation and pagination |
| §§7.6, 10.3 | Grounded assistant requests, saved conversation pagination, selected-document context, evidence/insufficient-evidence states and source/page links | Retrieval, embeddings/index compatibility, generation, saved messages and access revalidation |
| §§7.7, 8.4 | Profile, password and provider-neutral model/capture settings; first-capture/question guide | Persist settings; enforce identity/security policy and adapter availability |
| §§4.2, 14 | Audio recording/upload and transcript review; image query context/region citations; document invitations/grants/revocation; personal analytics | Transcription, multimodal retrieval, recipient identity/ACLs, metric aggregation/provenance |

Study time is displayed only when supplied with a measurement definition. **“Not measured” is not zero.** Topic coverage means tagged-document counts, not learning mastery.

## Stack

React + TypeScript, React Router, Vite, Tailwind CSS, Framer Motion, Lucide, raw Three.js, Recharts, clsx/tailwind-merge. No new production libraries were added. Unused React Three Fiber/Drei and confirmed-disconnected visuals/template assets were removed.

State and networking use React hooks/context and browser `fetch`, `AbortController`, `FormData`, `MediaRecorder` and `getUserMedia`. Zustand, TanStack Query, Zod and React Hook Form are not installed or required. No AI provider has been selected. The BRD's backend/storage examples are alternatives, not binding implementation decisions.

Exact resolved package versions are in `frontend/package-lock.json`. Approved development-only tools and their purposes are recorded in [PROJECT_MEMORY.md](PROJECT_MEMORY.md).

## Run locally

Use Node **22.22.3** (`.nvmrc`; compatible engine range is also in `package.json`).

```sh
nvm use
cd frontend
npm ci
cp .env.example .env.local
npm run dev -- --host 0.0.0.0
```

The UI listens on port 5173. Browser requests use `/api/v1`. Once a backend exists, set `API_PROXY_TARGET` to its origin in `.env.local`; Vite proxies `/api/*` server-side. Do not put a browser-facing `localhost` backend URL into a hosted preview.

Until that service exists, public pages can be reviewed, but authenticated workflows require a working API. The test suite supplies isolated HTTP fixtures; running the application does not enable them.

## Validate

From `frontend/`:

```sh
npm run lint
npm run test:types
npm test
npm run contract:check
npm run build
npm audit
npx playwright install --with-deps chromium
npm run test:e2e
```

`npm run contract:generate` regenerates `docs/openapi.json` after deliberate changes to DTOs/operations. `npm run test:watch` runs unit tests interactively. Playwright's server is test-owned and stops when tests finish unless an existing local server was reused.

[Frontend validation CI](.github/workflows/frontend.yml) runs the same categories on pushes/PRs. The workflow is added, but a remote GitHub run has not been observed in this session.

Latest local verification: **27 unit tests and 19 Chromium browser tests passed**, strict lint/type/build/contract checks passed, npm audit returned zero advisories. Automated WCAG A/AA checks found no violations in tested states; this is not a full accessibility certification. The lazy Three.js chunk remains approximately 526 kB minified and triggers a non-blocking build warning.

## Contract and deployment

- [OpenAPI 3.1](docs/openapi.json): schemas, operations, errors, authentication, permissions, jobs, pagination and multipart inputs.
- [Backend/deployment handoff](docs/BACKEND_HANDOFF.md): executable Netlify config, Render integration, cookie/CSRF and environment requirements.
- [Phase 4 repair and verification report](docs/PHASE_4_REPORT.md): F01–F41 disposition, test evidence, limitations and all README/BRD conflicts.
- [Frontend architecture](PROJECT_FRONTEND_CONTEXT.md): routes, state and component responsibilities.

Netlify builds `frontend/` with `npm run build` and publishes `dist/`. Its committed `/api/*` rule intentionally returns **503 JSON** until the actual Render reverse-proxy destination is configured; API failures must not fall through to the SPA's HTML. No deployment or backend integration is claimed.
