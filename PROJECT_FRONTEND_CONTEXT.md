# PROJECT FRONTEND CONTEXT

## 1. Executive Overview

This frontend application is the user interface for **KnowFlow**, an enterprise-grade AI Knowledge Assistant and Intelligence Hub. It is designed with a premium, highly interactive aesthetic featuring dark modes, fluid WebGL shaders, glassmorphism, and micro-interactions.

### Current Implementation Status
The frontend is primarily a UI/UX prototype. Most components are fully responsive and visually complete but operate on hardcoded mock data. 
- **Major Features Implemented**: Core routing, Global layout with sidebar, Fluid WebGL background shaders, 3D Canvas visualizers, Timeline with proximity-based framer-motion hover effects, Complex Capture dictation interface, and Dashboard analytics UI.
- **Missing Features**: Backend API integration, global state management (e.g., Redux/Zustand), persistent authentication, and real-time database syncing.
- **Overall Architecture**: A React Single Page Application (SPA) built with Vite. It uses `react-router-dom` for navigation, Tailwind CSS for utility-based styling, Framer Motion for complex animations, and Three.js/React Three Fiber for 3D visualizations.

---

## 2. Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.2.7 | Core UI library for building component-based architecture. |
| **Vite** | 8.1.1 | Build tool and dev server. Chosen for extremely fast HMR and compilation. |
| **Tailwind CSS** | 4.3.3 | Utility-first CSS framework for rapid styling without leaving JSX. |
| **React Router** | 7.18.1 | Handles client-side routing and nested layouts. |
| **Framer Motion** | 12.42.2 | Production-ready animation library used for page transitions, spring physics, and proximity hover effects. |
| **Lucide React** | 1.25.0 | SVG icon library. |
| **Three.js** | 0.185.1 | Low-level 3D graphics rendering. |
| **React Three Fiber (R3F)** | 9.6.1 | React renderer for Three.js, used in `LandingHeroGraph` and `KnowledgeWeb`. |
| **Recharts** | 3.9.2 | Composable charting library for dashboard analytics. |

---

## 3. Repository Structure

```text
frontend/
├── src/
│   ├── components/
│   │   ├── 3d/          # React Three Fiber & WebGL visualizers
│   │   ├── layout/      # Shared layout wrappers (SidebarLayout)
│   │   └── ui/          # Reusable, atomic UI components (Buttons, Cards, Shaders)
│   ├── hooks/           # Custom React hooks (e.g., useProximityEffect)
│   ├── pages/           # Route-level view components
│   ├── App.css          # Core CSS (minimal)
│   ├── App.tsx          # Root routing configuration
│   ├── index.css        # Tailwind directives and base layer styles
│   └── main.tsx         # Application entry point (React DOM render)
├── package.json
├── tailwind.config.ts   # Design tokens (colors, fonts, sizing)
├── tsconfig.json
└── vite.config.ts
```

---

## 4. Frontend Architecture

### Routing Hierarchy
The app uses a top-level `BrowserRouter` in `App.tsx`.
- The root contains unauthenticated/marketing pages (`/`, `/login`, `/onboarding`).
- A nested layout `<SidebarLayout>` wraps all internal application routes, providing a persistent sidebar navigation and a global fixed background canvas.

```mermaid
graph TD
    App[App.tsx BrowserRouter] --> Public[Public Routes]
    App --> Protected[SidebarLayout Wrapper]
    
    Public --> Landing[/]
    Public --> Login[/login]
    Public --> Onboarding[/onboarding]
    
    Protected --> Dashboard[/dashboard]
    Protected --> Capture[/capture]
    Protected --> Library[/library]
    Protected --> DocDetail[/document/:id]
    Protected --> Timeline[/timeline]
    Protected --> Assistant[/assistant]
    Protected --> Tasks[/tasks]
    Protected --> Settings[/settings]
```

---

## 5. Routing Documentation

| URL | Component | Layout | Purpose |
|-----|-----------|--------|---------|
| `/` | `Landing` | None | Marketing hero page with 3D Knowledge Web visualizer. |
| `/login` | `Login` | None | User authentication. |
| `/onboarding` | `Onboarding` | None | Initial user setup wizard with `Aurora` background. |
| `/dashboard` | `Dashboard` | `SidebarLayout` | Core analytics and overview. |
| `/capture` | `Capture` | `SidebarLayout` | Interface for ingesting knowledge (Dropzone, Voice, Text). |
| `/library` | `Library` | `SidebarLayout` | Filterable list of stored knowledge documents. |
| `/document/:id` | `DocumentDetail` | `SidebarLayout` | Deep-dive view of a single knowledge node. |
| `/timeline` | `Timeline` | `SidebarLayout` | Chronological activity feed. |
| `/assistant` | `Assistant` | `SidebarLayout` | Chat interface with the AI knowledge bot. |
| `/tasks` | `Tasks` | `SidebarLayout` | Actionable items and pending validations. |
| `/settings` | `Settings` | `SidebarLayout` | User configurations. |

---

## 6. Layout Documentation

### `SidebarLayout.tsx`
- **Purpose**: Wraps all internal app pages. It mounts the persistent `ShaderBackground` at `z-index: 0` so it acts as a global animated wallpaper. It handles the state (`sidebarOpen`) for expanding/collapsing the navigation menu.
- **Components Inside**: `LineSidebar` (custom animated nav), `ShaderBackground`, `Outlet` (react-router content).
- **Responsive Behavior**: The sidebar animates its `width` from `256px` to `0px` using Framer Motion when toggled by the topbar header button.

---

## 7. Pages Documentation

### `Capture.tsx`
- **Purpose**: Knowledge ingestion portal.
- **Components Used**: `GlassCard`, `UploadCloud`, `Mic`.
- **Layout**: 2-column desktop grid. Left column holds a File Drop Zone and Draft Text Intake. Right column holds a Voice Recording interface with animated waveform bars and metadata dropdowns.
- **State Used**: `isRecording` (boolean), `isDragging` (boolean).
- **Animations**: Waveform bars animate `height` via Framer Motion when `isRecording` is true.

### `Dashboard.tsx`
- **Purpose**: High-level system overview.
- **Components Used**: `Recharts` (AreaChart), `CountUp`, `GlassCard`.
- **Mock Data**: Hardcoded metrics for Active Nodes, Neural Links, Sync Rate, and Processing Load.

### `Timeline.tsx`
- **Purpose**: Shows chronological events.
- **Animations**: Uses highly sophisticated `useMotionValue`, `useSpring`, and `useTransform` from Framer Motion to create a proximity-based hover effect that scales the dot and interpolates colors using CSS `color-mix` based on mouse distance.

### `Library.tsx`
- **Purpose**: Document repository.
- **Animations**: Cards stagger in on load. Hovering a card lifts it on the Y-axis.

---

## 8. Component Documentation

### UI Components

#### `LineSidebar.tsx`
- **Purpose**: The primary navigation menu used inside `SidebarLayout`.
- **Animations**: Uses Framer Motion's `useMotionValue` and `useTransform` to track mouse proximity (`pointerY`). As the user's cursor approaches an item, the line marker scales up, the text shifts to the right, and the colors interpolate smoothly. 
- **Dependencies**: `framer-motion`.

#### `ShaderBackground.tsx`
- **Purpose**: Renders a raw WebGL canvas that paints a fluid, noise-based shader.
- **Styling**: `fixed inset-0 z-0 w-full h-full`.
- **Usage**: Mounted once in `SidebarLayout`. It runs a raw `requestAnimationFrame` loop interacting directly with `gl.uniform1f`.

#### `GlassCard.tsx`
- **Purpose**: A reusable card wrapper implementing the glassmorphism aesthetic.
- **Styling**: Uses `rgba(251, 233, 208, 0.5)` with `backdrop-filter: blur(20px)`.

#### `PixelCard.tsx`
- **Purpose**: A visually complex card that creates a pixel-disintegration effect on hover using an internal HTML5 Canvas and `requestAnimationFrame`.

#### `Aurora.tsx`
- **Purpose**: Renders slow-moving, heavily blurred background colored orbs (`bg-sage`, `bg-signal-red`, `bg-umber`) using Framer Motion. Used currently in `Onboarding`.

---

## 9. UI Design System

Defined primarily in `tailwind.config.ts`.
- **Color Palette**: 
  - `deep-slate` (#244855) - Primary dark background/text.
  - `signal-red` (#E64833) - Primary accent/action color.
  - `umber` (#874F41)
  - `sage` (#90AEAD)
  - `sand` (#FBE9D0) - Primary light background.
  - Note: There are also Stitch-specific aliases (e.g., `primary`, `secondary`, `surface`).
- **Typography**: 
  - Heading: `"Space Grotesk"`
  - Body: `"Inter"`
  - Monospace: `"IBM Plex Mono"`
- **Glassmorphism**: Achieved by combining translucent backgrounds (`rgba(..., 0.5)`), thin borders (`border-outline/30`), and heavy backdrop blurs (`backdrop-blur-xl`).

---

## 10. Styling Documentation

- **Global Styles**: Defined in `index.css`. The `body` uses `@apply bg-sand text-deep-slate font-body;`.
- **Note on Backgrounds**: To ensure the `ShaderBackground` canvas is visible, wrapper divs in `App.tsx` and `SidebarLayout.tsx` are intentionally left transparent (no background color).

---

## 11. Animation Documentation

- **Library**: `framer-motion` is the undisputed core of UI animations.
- **Proximity Hover**: Found in `LineSidebar.tsx` and `Timeline.tsx`. It uses `e.clientY - rect.top` to calculate mouse distance to element centers, mapping that distance via `useTransform` to scale, color-mix, and translations.
- **Page Transitions**: Handled via `variants` (e.g., `containerVariants`, `itemVariants`) using staggered children (`staggerChildren: 0.1`).
- **WebGL**: `ShaderBackground` and `PixelCard` use native `requestAnimationFrame` for high-performance canvas mutations.

---

## 12. State Management

- **Local State**: `useState` is used extensively for localized interactions (e.g., sidebar toggling, recording state).
- **Global State**: Not Found in Current Frontend. There is no Redux, Zustand, or Context API configured yet. Prop drilling is currently minimal because data is mocked per-page.

---

## 13. Custom Hooks

### `useProximityEffect.ts`
- **Purpose**: Originally authored to handle DOM-based proximity math. 
- **Current Status**: Deprecated/Unused. Both `LineSidebar` and `Timeline` have been refactored to use native `framer-motion` hooks (`useMotionValue`) which provide much better performance and cleaner React synchronization.

---

## 14. Utility Functions

- **`cn`** (in `Button.tsx`): A standard `clsx` and `tailwind-merge` wrapper used to safely concatenate conditional Tailwind classes.

---

## 15. Forms Documentation

- **Current Status**: Most forms (Login, Settings, Onboarding) are mocked. They use native HTML `<input>` and `<select>` elements but lack `onSubmit` handlers or form-validation libraries (like Zod or React Hook Form).
- **Future API**: All form submissions will require integration with authentication APIs and data mutation endpoints.

---

## 16. Data Flow

- **Current Data**: Data is hardcoded as constants at the top of page components (e.g., `const TASKS = [...]` in `Tasks.tsx`).
- **Future Integration**: The application will need a data-fetching layer (e.g., TanStack Query or native `fetch` inside `useEffect`) to pull real data.

---

## 17. Performance

- **Memoization**: Minimal. `useCallback` is used in a few custom canvas animations.
- **Animations**: Intensive animations are offloaded to WebGL (Shaders) or CSS transforms via Framer Motion, ensuring 60fps performance without triggering React layout thrashing.
- **Future Optimization**: Route-level code splitting (`React.lazy`) should be implemented as the application grows.

---

## 18. Configuration Files

- **`vite.config.ts`**: Barebones React Vite configuration.
- **`tailwind.config.ts`**: Contains all brand tokens, custom colors, fonts, and fontSize scales.
- **`package.json`**: Lists all dependencies. Note the inclusion of `@tailwindcss/postcss` for Tailwind CSS v4 support.

---

## 19. AI Developer Guide

- **Architecture Principles**: Prioritize visual excellence. Never use plain backgrounds if a glassmorphic or shader background makes sense.
- **Component Patterns**: Always wrap page content in a `<motion.div>` with staggered entrance animations.
- **Styling**: Do not modify `index.css` unless absolutely necessary. Rely entirely on Tailwind utility classes and the predefined tokens in `tailwind.config.ts`.
- **Animations**: Do NOT use manual `requestAnimationFrame` loops for DOM elements. Always use `framer-motion` (`useMotionValue`, `useTransform`, `useSpring`) for complex interactive physics. Manual RAF loops are strictly reserved for `<canvas>` WebGL contexts.
- **Routing**: New pages must be added to `App.tsx`. If they are authenticated app pages, they MUST be nested under the `<Route element={<SidebarLayout />}>` block.

---

## 20. Current Progress Report

- **Completed**: UI/UX Layout, Global Theming, Routing Structure, Proximity Animations, WebGL Shaders.
- **Pending**: Backend Integration, Authentication Flow, State Management Setup.
- **Next Recommended Steps**: 
  1. Implement a global state store (Zustand).
  2. Implement a data-fetching library (React Query).
  3. Replace mocked JSON arrays in pages with API calls.
