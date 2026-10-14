# KnowFlow Agent Configuration

## Start here

1. Read `PROJECT_MEMORY.md`, then `PROJECT_FRONTEND_CONTEXT.md`.
2. Read the user's current phase/approval and actual relevant BRD sections before changing scope.
3. Check the working tree and actual files. Historical mock screenshots/design exports are not implementation requirements.

## Authority and scope

KnowFlow is a **personal** knowledge/productivity hub. BRD requirements plus explicit user decisions outrank stale README/design descriptions. All BRD features, including future extensions, are mandatory for the target application. Collaboration was explicitly clarified as selected-document view/edit sharing, not shared workspaces.

Phase 4 is frontend plus provider-neutral backend contract; backend implementation comes later. Phase 5 requires separate approval. Do not claim live persistence, ML/AI results or production authorization when no backend is connected.

Keep existing React/TypeScript/browser runtime facilities. Do not add Zustand, TanStack Query, Zod, form libraries or provider SDKs without approval. Approved **dev-only regression** dependencies and exact reasons are in PROJECT_MEMORY.md. Frontend deploys to Netlify; backend to Render; all secrets/adapters remain server-side.

## Code conventions

- Use route-level pages under `frontend/src/pages`, shared UI under `components/ui`, layout under `components/layout`, and existing hooks/client/DTO boundaries.
- Add routes in `App.tsx`; business screens need RequireAuth/SidebarLayout, with a separate Admin gate where appropriate.
- Use semantic links/buttons/labels, visible focus and explicit loading/error/empty states. Hidden navigation/forms must not stay focusable.
- Keep Tailwind design tokens/shared controls consistent; use `cn` where conditional merging needs it. Necessary global accessibility fixes in index.css are permitted.
- Use Framer Motion for DOM animations and honor reduced motion. Canvas/WebGL may use RAF with complete cleanup and visibility suspension. Retained 3D uses raw Three.js, not R3F.
- No unsafe type casts to bypass business errors. No runtime mock success. Server-returned text must not become active HTML.
- Comments should explain non-obvious reasons, not restate code. Avoid unrelated refactoring, unnecessary dependencies and unused decorative controls.

## Verification and handoff

Run build, strict lint, test types, unit tests, contract check, dependency audit and browser regressions for affected workflows. Keep generated OpenAPI synchronized with DTOs and operation semantics. Report actual results and remaining backend/hardware/browser limits; no unsupported compliance, SLA, accuracy or 60fps claims.

Update the approved memory/report when meaningful state changes. Do not commit, push, deploy, start the next phase or introduce new scope unless authorized. Tool connections must be checked in the actual environment; an old MCP config is not proof that a design service is connected or required.
