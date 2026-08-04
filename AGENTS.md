# KnowFlow Agent Configuration
_Rules and workflows for AI agents working on this project._

## Session Startup Protocol
1. Read `PROJECT_MEMORY.md` first — contains full project context, BRD summary, tech stack, routing, status
2. Read `PROJECT_FRONTEND_CONTEXT.md` — detailed frontend architecture documentation
3. Check `.mimocode/settings.json` — MCP server configuration
4. Verify Google Stitch MCP is connected (restart session if needed)

## Project Identity
**KnowFlow** is an Enterprise AI Knowledge Assistant. This is a **frontend-only prototype** currently. The BRD defines a full-stack system with Python backend, OpenCV, ML, and RAG pipeline.

## Work Priorities (from BRD)
1. **Backend API** — Python FastAPI (recommended) with endpoints for:
   - Image upload + OCR processing
   - Document ingestion (PDF, DOCX, text)
   - ML classification and topic tagging
   - RAG query endpoint
   - Task management CRUD
   - User authentication
2. **State Management** — Zustand stores for:
   - Auth state
   - Documents/library
   - Tasks
   - Chat/assistant
3. **Data Fetching** — React Query (TanStack Query) for:
   - API integration
   - Caching
   - Optimistic updates
4. **Replace Mock Data** — All pages currently use hardcoded constants

## Code Style Rules
- **No comments** unless WHY is non-obvious
- **No emojis** in code or files
- **Tailwind utilities only** — no custom CSS unless absolutely necessary
- **Framer Motion** for all DOM animations — no manual RAF for DOM elements
- **WebGL/Canvas** — raw RAF is fine for shader/canvas contexts
- **Component pattern**: `motion.div` wrapper with staggered entrance variants
- **Class merging**: Use `cn()` utility (clsx + tailwind-merge)
- **Responsive**: Mobile-first Tailwind breakpoints
- **Accessibility**: Semantic HTML, proper ARIA labels

## File Conventions
- **Pages**: `src/pages/<Name>.tsx` — route-level components
- **UI Components**: `src/components/ui/<Name>.tsx` — reusable atoms
- **3D Components**: `src/components/3d/<Name>.tsx` — React Three Fiber
- **Layout**: `src/components/layout/<Name>.tsx` — structural wrappers
- **Hooks**: `src/hooks/<name>.ts` — custom React hooks

## Design Tokens (tailwind.config.ts)
| Token | Hex | Usage |
|-------|-----|-------|
| `deep-slate` | #244855 | Primary dark, text |
| `signal-red` | #E64833 | Accent, actions |
| `umber` | #874F41 | Secondary accent |
| `sage` | #90AEAD | Subtle accent |
| `sand` | #FBE9D0 | Light background |

## Key Files Reference
| File | Purpose |
|------|---------|
| `App.tsx` | Root router — add new routes here |
| `SidebarLayout.tsx` | Wraps all authenticated pages |
| `LineSidebar.tsx` | Main navigation with proximity hover |
| `ShaderBackground.tsx` | Global WebGL animated wallpaper |
| `GlassCard.tsx` | Reusable glassmorphism card |
| `tailwind.config.ts` | All design tokens |
| `package.json` | Dependencies |

## MCP Tools Available
- **Google Stitch** — Design tool integration via MCP remote server
  - Config: `.mimocode/settings.json`
  - Endpoint: `https://stitch.googleapis.com/mcp`
  - Use for: Design assets, UI components, visual elements

## Architecture Notes (from BRD)
- **Frontend**: React SPA (currently), could expand to full-stack
- **Backend**: Python FastAPI recommended
- **Processing**: OpenCV for image preprocessing, Tesseract for OCR
- **ML**: Transformer models for classification, topic modeling, action detection
- **RAG**: LangChain or custom pipeline with embeddings + vector DB
- **Storage**: PostgreSQL (metadata) + FAISS/Chroma/Qdrant (vectors)
- **LLM**: API integration for summarization, Q&A, task extraction

## Do NOT
- Commit/push unless explicitly asked
- Modify `index.css` unless absolutely necessary
- Use plain backgrounds where glassmorphic/shader works
- Add features beyond what's requested
- Add comments explaining what code does (names should do that)
- Create documentation unless asked
