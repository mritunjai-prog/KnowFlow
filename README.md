# KnowFlow
> Enterprise AI Knowledge Assistant and Intelligence Hub

![Status](https://img.shields.io/badge/status-prototype-orange)
![React](https://img.shields.io/badge/React-19.2.7-blue)
![Vite](https://img.shields.io/badge/Vite-8.1.1-purple)
![Tailwind](https://img.shields.io/badge/TailwindCSS-4.3.3-38B2AC)

## Table of Contents
- [Overview / About](#overview--about)
- [Features](#features)
- [Demo / Screenshots](#demo--screenshots)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables / Configuration](#environment-variables--configuration)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Scripts / Commands](#scripts--commands)
- [Testing](#testing)
- [Deployment](#deployment)
- [Folder-by-Folder Deep Dive](#folder-by-folder-deep-dive)
- [Troubleshooting / FAQ](#troubleshooting--faq)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments / Credits](#acknowledgments--credits)
- [Contact / Support](#contact--support)

## Overview / About
**KnowFlow** is an enterprise-grade AI Knowledge Assistant designed to help students and professionals organize scattered notes, documents, and whiteboard captures. This repository currently houses the **frontend UI prototype**, featuring a rich, highly interactive aesthetic with glassmorphism, WebGL shaders, and smooth micro-interactions. It aims to solve the problem of unstructured data by providing a unified platform to capture, store, and process personal knowledge artifacts using planned Machine Learning and RAG features.

## Features
- **Knowledge Capture Interface**: Dropzone for files, text intake, and an animated voice dictation UI.
- **Interactive Dashboard**: High-level system overview with charts (Recharts) and mock analytics.
- **Document Library**: Filterable list of stored knowledge nodes with 3D hover interactions.
- **Proximity Timeline**: Chronological activity feed utilizing proximity-based framer-motion hover effects.
- **AI Assistant UI**: Chat interface for querying the planned AI assistant.
- **Fluid WebGL Backgrounds**: Animated raw WebGL shaders and React Three Fiber graphs running in the background for a premium feel.
- **Global Sidebar Navigation**: Expandable/collapsible sidebar with fluid motion physics.

## Demo / Screenshots
<!-- TODO: Add live demo link here -->
<!-- TODO: Add a GIF demonstrating the Proximity Timeline hover effect -->
<!-- TODO: Add screenshot of the Capture dictation interface -->
<!-- TODO: Add screenshot of the Dashboard -->

## Tech Stack
### Frontend
- **React** (v19.2.7) - UI component architecture
- **Vite** (v8.1.1) - Lightning-fast build tool and dev server
- **Tailwind CSS** (v4.3.3) - Utility-first styling with custom tokens
- **React Router** (v7.18.1) - Client-side navigation
- **Framer Motion** (v12.42.2) - Complex spring physics and proximity animations
- **Three.js** (v0.185.1) & **React Three Fiber** (v9.6.1) - 3D visualizers and WebGL
- **Recharts** (v3.9.2) - Dashboard analytics charts
- **Lucide React** (v1.25.0) - SVG iconography

### Backend / Database (Planned)
- Python (FastAPI recommended)
- PostgreSQL (metadata)
- FAISS/Chroma (Vector Database)
- OpenCV / LangChain (Data Processing & RAG)

## Architecture
Currently, the system is a **Frontend-only Single Page Application (SPA)**. 
- **Routing Structure**: Built around a top-level `BrowserRouter`. Marketing pages (`/`, `/login`, `/onboarding`) are unauthenticated. The core application is nested inside a protected `<SidebarLayout>` wrapper that manages the persistent navigation menu and the global WebGL background shader.
- **Data Flow**: Presently uses hardcoded mock arrays defined at the top of page components. A future integration phase will replace this with a data-fetching layer (e.g., TanStack Query) hooked into the Python FastAPI backend.

## Project Structure
```text
.
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── 3d/        # WebGL shaders & React Three Fiber visualizers
│   │   │   ├── layout/    # Shared wrappers like SidebarLayout
│   │   │   └── ui/        # Reusable atoms (GlassCard, Button, Aurora)
│   │   ├── pages/         # Route-level views (Dashboard, Capture, Library)
│   │   ├── App.tsx        # Root routing configuration
│   │   └── main.tsx       # Application entry point
│   ├── package.json       # Dependencies & npm scripts
│   ├── tailwind.config.ts # Design tokens (colors, fonts, sizing)
│   └── vite.config.ts     # Vite bundler config
├── BRD...pdf              # Business Requirements Document (Project spec)
├── PROJECT_FRONTEND_CONTEXT.md # Frontend architecture rules
└── PROJECT_MEMORY.md      # Core status and context memory
```

## Prerequisites
To run this project locally, ensure you have the following installed:
- **Node.js** (v18.0.0 or higher recommended)
- **npm** (v9.0.0+)

## Installation
### Local Development
```bash
# 1. Clone the repository
git clone https://github.com/mritunjai-prog/KnowFlow.git

# 2. Navigate to the frontend directory
cd KnowFlow/frontend

# 3. Install dependencies
npm install

# 4. Start the development server
npm run dev
```
The application will be accessible at `http://localhost:5173`.

## Environment Variables / Configuration
There are currently **no environment variables, secrets, or `.env` files** required to run the frontend UI prototype. All data is mocked and no external APIs are hit natively yet. 
*(Note: A `.mimocode/settings.json` exists for local IDE configuration to connect to the Google Stitch MCP server for design assets).*

## Usage
Start the app in dev mode using `npm run dev` from the `frontend` folder.
- **Marketing**: Navigate to `http://localhost:5173/` to see the 3D Knowledge Web.
- **Auth**: Go to `/login` and `/onboarding` to view the entry flows.
- **App Core**: Navigate to `/dashboard` to enter the main authenticated wrapper with the sidebar, and explore `/capture`, `/library`, `/timeline`, and `/tasks`.

## API Documentation
*Not applicable.* The project is currently a frontend UI prototype. Backend APIs (FastAPI) are planned on the roadmap.

## Database Schema
*Not applicable.* Currently relying on mock data constants inside React components. PostgreSQL and Vector DBs will be introduced alongside the backend integration.

## Scripts / Commands
All commands are run from the `frontend/` directory.

| Command | Description |
|---------|-------------|
| `npm run dev` | Starts the Vite development server with Hot Module Replacement (HMR). |
| `npm run build` | Compiles TypeScript and builds the production bundle via Vite. |
| `npm run lint` | Runs `oxlint` to check for code quality and syntax issues. |
| `npm run preview` | Boots a local web server to preview the compiled production `dist/` folder. |

## Testing
*Not applicable.* There are currently no testing frameworks (like Jest, Vitest, or Cypress) configured in this repository.

## Deployment
<!-- TODO: Add specific deployment platform details once decided (e.g., Vercel, Netlify) -->
The frontend can be easily deployed to static hosting platforms like Vercel or Netlify:
1. Set the build command to `npm run build`
2. Set the publish directory to `frontend/dist`
3. Ensure client-side routing is configured (rewrite all traffic to `/index.html`).

## Folder-by-Folder Deep Dive
- **`frontend/src/components/3d/`**: Contains advanced React Three Fiber implementations (e.g., `KnowledgeWeb.tsx`, `LandingHeroGraph.tsx`) and raw WebGL shaders (`ShaderBackground.tsx`) for the premium interactive backgrounds.
- **`frontend/src/components/ui/`**: Core reusable aesthetic blocks like `GlassCard.tsx` (blur effects) and `LineSidebar.tsx` (proximity hover navigation).
- **`frontend/src/pages/`**: Each file maps 1-to-1 with a route defined in `App.tsx`.

## Troubleshooting / FAQ
**Q: The 3D background is consuming too much CPU.**
A: The `ShaderBackground.tsx` runs a continuous `requestAnimationFrame` loop. Ensure you are not running it on multiple overlapping components.

**Q: I get errors about missing Tailwind classes.**
A: This project uses Tailwind CSS v4. Ensure your IDE is using the latest Tailwind IntelliSense extension, as configuration patterns (like `@tailwindcss/postcss`) have changed from v3.

## Roadmap
- [ ] Implement global state management using Zustand.
- [ ] Implement data fetching layer using TanStack React Query.
- [ ] Connect frontend to Python FastAPI endpoints.
- [ ] Replace mock JSON objects with real DB data.
- [ ] Implement robust Form validation (e.g., Zod + React Hook Form).

## Contributing
<!-- TODO: Define strict contribution rules or link to a CONTRIBUTING.md -->
Contributions are welcome. Please ensure that you:
1. Maintain the high visual standard (use Framer Motion for DOM physics, raw RAF for WebGL only).
2. Adhere to Tailwind for styling; avoid custom CSS in `index.css`.
3. Wrap new page components in staggered `<motion.div>` variants.

## License
<!-- TODO: Add license information. No LICENSE file was found in the repository. -->
This repository currently does not have a license file. Please contact the maintainers regarding usage rights.

## Acknowledgments / Credits
- Design system inspired by modern glassmorphic enterprise SaaS dashboards.
- Utilizes [Google Stitch MCP](https://stitch.googleapis.com) for design asset integration.

## Contact / Support
<!-- TODO: Add maintainer contact email or Twitter handle -->
- **Maintainer**: [Your Name/Handle Here]
- **Issue Tracker**: Please use the GitHub Issues tab for bugs and feature requests.
