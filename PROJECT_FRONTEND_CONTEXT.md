# KnowFlow Frontend Context

Updated for Phase 4. Read `PROJECT_MEMORY.md` for authority, approvals, exact tooling additions and verification limits.

## Architecture

React/TypeScript SPA with Vite and React Router. App wraps routes in an error boundary, user-respecting MotionConfig, AuthProvider and Suspense. Public pages do not imply a working session; guarded routes wait for `/session`. Server-returned `user`/`admin` determines navigation and the Admin gate. Backend authorization is independently required.

| URL | Screen |
|---|---|
| `/` | Personal-product landing with optional-motion lazy raw Three.js hero |
| `/login` | A single active sign-in or registration form; validated submission and safe return destination |
| `/onboarding` | First capture, source review and question guide; completion persisted through API |
| `/dashboard` | Personal counts, period activity/chart/table, topic coverage and defined nullable study time |
| `/capture` | Batch upload/drop, clipboard/text, camera/audio, metadata and meeting association |
| `/processing/:id` | Backend job polling, partial results, retry/cancel and artifact links |
| `/library` | Canonical paginated/filterable document list and owned/shared filtering |
| `/document/:id` | Authorized originals/preprocessed sources, extracted text/metadata, editing and owner grants |
| `/meetings` | Meeting list/search/create |
| `/meetings/:id` | Artifacts, tasks, decisions and summary/job action |
| `/timeline` | Source-linked history grouped in the browser's local timezone |
| `/assistant` | Paginated conversations, query/image context, evidence and source/page/region references |
| `/tasks` | Personal source-linked create/edit/delete/complete, due dates, priorities and filters |
| `/sharing` | Recipient invitation acceptance/decline and links to shared documents |
| `/settings` | Profile, capture/model preferences and password update |
| `/admin` | Admin-only configuration, storage/job counts and safe service-health information |
| unmatched | Recoverable not-found page |

All nonpublic business routes above require a session and use SidebarLayout. There is no second, unused DocumentLibrary implementation. Shared documents are not shared workspaces.

## Data flow

- `api/types.ts`: domain DTOs only; no provider SDK types or secrets.
- `api/client.ts`: public API base, cookie credentials, in-memory CSRF token, JSON/multipart handling, 45-second timeout, cancellation, safe source URLs, errors and session-expiry signal.
- `api/hooks.ts`: path-keyed cancellable resources; same-path refresh retains content, errors clear it, obsolete responses are ignored. Optional three-second polling checks a current flag and stops on terminal jobs. Actions prevent synchronous double submission, abort on unmount, and announce success only after server completion.
- `auth/AuthContext.tsx` and `auth/context.ts`: server session plus immediate authentication override; refresh does not unnecessarily unmount a valid session. Guard errors display unavailability rather than fabricate login.
- Local state holds unsaved forms/selections only. URL search parameters preserve filters/context. No production mock store or localStorage auth token exists.
- Runtime response typing is not schema validation; backend contract/error/authorization tests are necessary when connecting the service.

## UI and interaction primitives

`Feedback.tsx` provides Page/Panel, labels, loading/error/notice/empty feedback, pagination, native modal Dialog with focus restoration, not-found/access-denied and a render error boundary. `Button` uses explicit native props/default type and Framer Motion without unsafe type escapes. Sidebar links are actual NavLinks. The mobile drawer unmounts when closed; collapsed desktop navigation and inactive auth forms do not leave hidden focus targets.

Capture validates types/limits against capabilities. Object URLs are revoked. Camera/audio streams, recorder callbacks and timers are cleaned up; late permission results stop their tracks. Recording uses the latest callback so simultaneous intake additions are not overwritten. Submit waits for active media capture to finish. Unchanged failed ingestions/queries reuse an idempotency key; success, changed content or a new operation changes it.

Document text, messages and snippets render as React text, not injected HTML. Source URLs reject executable/data schemes. Images support native source viewing/zoom and audio has native controls; PDF links include the cited page. DOCX/PDF use the browser/download source link rather than adding an unapproved viewer library. The backend controls access/expiry and must serve safe file content types.

## Styling, assets and graphics

Tailwind tokens remain based on slate/sand/umber/sage with a darker accessible action-red semantic value. Prefer existing utilities and shared controls. `index.css` has necessary global focus/reduced-motion rules; it is not forbidden to fix accessibility at the global layer. Typography uses an intentional system fallback, with no required remote font request. Controls use bundled Lucide icons.

Raw Three.js is only the retained landing graph; React Three Fiber/Drei were unused after cleanup and removed. The graph caps DPR, disposes meshes/materials/renderer, stops hidden/offscreen work and tolerates missing WebGL. ShaderBackground checks compile/link success, sizes on resize, disposes resources and uses a static sand fallback. CountUp uses motion values correctly and immediately shows the final value when motion/duration is disabled.

Lazy routes isolate Recharts and Three.js. The remaining ~526 kB Three.js chunk warning is documented, not suppressed. Frame rate, heap growth over days and real-device GPU behavior are not certified by the browser regression suite.

## Test and deployment boundaries

See README for commands and `docs/PHASE_4_REPORT.md` for exact evidence. Browser fixtures live in `frontend/tests/fixtures.ts`, never in application imports. Test types are checked separately. Native-media success is simulated in unit tests; real permission-denial/fallback behavior is checked in Chromium.

`netlify.toml` is executable build/SPA/API-fallback configuration; `.env.example` distinguishes browser-public API base from Vite's server-side proxy target. Real Render proxy/cookies/CSRF/private caching/provider setup is explained in `docs/BACKEND_HANDOFF.md`. No provider, backend framework, database or live credentials have been selected by this frontend work.
