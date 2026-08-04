# KnowFlow Project Memory
_Persistent context for new sessions. Read this first._

## Project Identity
**KnowFlow** — Enterprise AI Knowledge Assistant and Intelligence Hub. A final-year CS project combining ML, OpenCV computer vision, RAG pipeline, and a rich web UI. Targets students and knowledge workers who struggle to organize scattered notes, documents, meeting content, and screenshots.

## BRD Summary (9 pages)
**Problem**: Students/professionals generate unstructured data (handwritten notes, PDFs, whiteboards, screenshots). Traditional storage lacks semantic understanding, summarization, or task extraction.

**Objectives**:
1. Unified platform to capture, store, process personal knowledge artifacts
2. OpenCV-based image processing (page detection, enhancement, region detection)
3. ML models for document classification, topic modeling, action-item detection
4. Basic RAG pipeline for grounded Q&A and summarization
5. Modern UI with search, chat assistant, timeline, and task management

**In-Scope Features**:
- Image capture + preprocessing (handwritten notes, slides, whiteboards)
- OCR text extraction (Tesseract or deep learning-based)
- Digital file ingestion (PDF, DOCX, plain text)
- ML-based classification & topic tagging
- Action-item detection and task creation
- RAG-based question answering over stored content
- Responsive web UI (document library, timeline, chat, tasks)

**System Architecture** (from BRD):
```
Frontend: React/Vue/Angular
Backend:  Python (FastAPI/Django) or Node.js
Services: OpenCV preprocessing, OCR, ML classification, RAG pipeline
Storage:  PostgreSQL/MySQL (metadata) + FAISS/Chroma/Qdrant (vectors)
LLM:      Integration for summarization, Q&A, action extraction
```

**Success Metrics**:
- Documents successfully ingested and searchable
- Classification/tagging accuracy on labeled samples
- RAG answer quality (user rubric rating)
- Action-item detection correctness
- UI usability and responsiveness

## Tech Stack (Current Frontend)
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2.7 | Core UI library |
| Vite | 8.1.1 | Build tool + dev server |
| Tailwind CSS | 4.3.3 | Utility-first CSS |
| React Router | 7.18.1 | Client-side routing |
| Framer Motion | 12.42.2 | Animations |
| Lucide React | 1.25.0 | SVG icons |
| Three.js | 0.185.1 | 3D graphics |
| React Three Fiber | 9.6.1 | React renderer for Three.js |
| Recharts | 3.9.2 | Dashboard charts |

## Repository Structure
```
D:\KnowFlow\
├── BRD  Intelligent Personal Productivity Hub Using ML, OpenCV, and RAG.pdf
├── PROJECT_FRONTEND_CONTEXT.md
├── PROJECT_MEMORY.md (this file)
├── dashboard_latest.html
├── base64.txt
├── .mimocode/
│   ├── settings.json (Google Stitch MCP config)
│   └── package.json
└── frontend/
    ├── src/
    │   ├── App.tsx              # Root router (12 routes)
    │   ├── main.tsx             # Entry point
    │   ├── index.css            # Tailwind directives
    │   ├── App.css              # Minimal core CSS
    │   ├── assets/
    │   ├── components/
    │   │   ├── 3d/              # React Three Fiber visualizers
    │   │   │   ├── DocumentPlanes.tsx
    │   │   │   ├── IcosahedronCore.tsx
    │   │   │   ├── KnowledgeWeb.tsx
    │   │   │   ├── LandingHeroGraph.tsx
    │   │   │   ├── NetworkGraph.tsx
    │   │   │   ├── SequenceOrchestrator.tsx
    │   │   │   └── ShaderBackground.tsx
    │   │   ├── layout/
    │   │   │   └── SidebarLayout.tsx
    │   │   └── ui/
    │   │       ├── Aurora.tsx
    │   │       ├── Button.tsx
    │   │       ├── Card.tsx
    │   │       ├── CountUp.tsx
    │   │       ├── GlassCard.tsx
    │   │       ├── LineSidebar.tsx
    │   │       ├── PixelCard.tsx
    │   │       ├── ShaderBackground.tsx
    │   │       └── SplitText.tsx
    │   ├── hooks/
    │   └── pages/
    │       ├── Assistant.tsx
    │       ├── Capture.tsx
    │       ├── Dashboard.tsx
    │       ├── DocumentDetail.tsx
    │       ├── DocumentLibrary.tsx
    │       ├── Landing.tsx
    │       ├── Library.tsx
    │       ├── Login.tsx
    │       ├── Onboarding.tsx
    │       ├── Settings.tsx
    │       ├── Tasks.tsx
    │       └── Timeline.tsx
    ├── package.json
    ├── tailwind.config.ts
    ├── tsconfig.json
    └── vite.config.ts
```

## Routing (App.tsx)
| URL | Component | Layout | Purpose |
|-----|-----------|--------|---------|
| `/` | Landing | None | Marketing hero + 3D Knowledge Web |
| `/login` | Login | None | User authentication |
| `/onboarding` | Onboarding | None | Setup wizard + Aurora background |
| `/dashboard` | Dashboard | SidebarLayout | Core analytics overview |
| `/capture` | Capture | SidebarLayout | Knowledge ingestion (Dropzone, Voice, Text) |
| `/library` | Library | SidebarLayout | Filterable document list |
| `/document/:id` | DocumentDetail | SidebarLayout | Single knowledge node view |
| `/timeline` | Timeline | SidebarLayout | Chronological activity feed |
| `/assistant` | Assistant | SidebarLayout | AI chat interface |
| `/tasks` | Tasks | SidebarLayout | Actionable items + validations |
| `/settings` | Settings | SidebarLayout | User configurations |

## UI Design System
**Colors** (tailwind.config.ts):
- `deep-slate` (#244855) — Primary dark background/text
- `signal-red` (#E64833) — Primary accent/action
- `umber` (#874F41)
- `sage` (#90AEAD)
- `sand` (#FBE9D0) — Primary light background

**Typography**:
- Heading: `"Space Grotesk"`
- Body: `"Inter"`
- Monospace: `"IBM Plex Mono"`

**Glassmorphism**: Translucent backgrounds (`rgba(..., 0.5)`), thin borders, heavy backdrop blurs (`backdrop-blur-xl`)

## Current Status
- **DONE**: UI/UX layout, global theming, routing, proximity animations, WebGL shaders
- **MISSING**: Backend API, global state (Zustand), auth, real-time DB syncing, React Query
- **NEXT STEPS**: 
  1. Zustand for state management
  2. React Query (TanStack Query) for data fetching
  3. Replace mock data with API calls
  4. Backend implementation (Python FastAPI recommended per BRD)

## AI Developer Rules
- Prioritize visual excellence; never plain backgrounds when glassmorphic/shader works
- Always wrap page content in `motion.div` with staggered entrance animations
- Don't modify `index.css`; use Tailwind utilities + tailwind.config.ts tokens
- No manual `requestAnimationFrame` for DOM; use framer-motion hooks. RAF only for WebGL canvas.
- New pages go in `App.tsx`; authenticated pages nested under `<SidebarLayout />`
- Use `cn()` (clsx + tailwind-merge) for conditional class merging

## MCP Configuration
Google Stitch MCP server configured in `.mimocode/settings.json`:
```json
{
  "mcpServers": {
    "google-stitch": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://stitch.googleapis.com/mcp", "--header", "X-Goog-Api-Key: YOUR_API_KEY_HERE"]
    }
  }
}
```

## Key Component Patterns
- **LineSidebar**: Proximity-based hover using `useMotionValue` + `useTransform` from Framer Motion
- **ShaderBackground**: Raw WebGL canvas with fluid noise shader, `requestAnimationFrame` loop
- **GlassCard**: Reusable glassmorphism wrapper (`rgba(251, 233, 208, 0.5)` + `backdrop-blur-xl`)
- **PixelCard**: Pixel-disintegration hover effect using HTML5 Canvas
- **Aurora**: Slow-moving blurred background orbs for Onboarding
- **Dashboard**: Recharts AreaChart + CountUp metrics + GlassCard
- **Timeline**: Proximity-based hover with `color-mix` interpolation
- **Capture**: 2-column grid with file drop zone, voice recording with animated waveform
