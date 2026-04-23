# AI-OBE Ship Control & Education Platform - Gemini Context

## Project Overview

This project is a unified, modern web application for **Ship Control Theory Education**, **AI-Assisted Learning**, and **Engineering Ethics**. It has transitioned from a monorepo structure to a centralized **Next.js 14** application.

The platform integrates rigorous maritime engineering models with interactive 3D simulations, a knowledge graph system, and an AI-driven "Virtual Chief Engineer" to provide an immersive Outcome-Based Education (OBE) experience.

### Core Architecture

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + Shadcn/ui
- **3D Engine:** Three.js via React Three Fiber (@react-three/fiber)
- **AI Integration:** Vercel AI SDK (integrated with SiliconFlow/Qwen/OpenAI)
- **Database:** Prisma ORM (SQLite/PostgreSQL)
- **Auth:** NextAuth.js
- **State Management:** Zustand (Global) + React State (Local)
- **Visualization:** Recharts, Chart.js, and @xyflow/react (for Knowledge Graph)

---

## 🏗️ Project Structure

The codebase is organized into a single Next.js application at the root directory:

- **`src/app/`**: Application routes and pages.
  - `(auth)/`: Authentication flow (login, register).
  - `(main)/`: Core user experience (dashboard, missions, profile).
  - `ai/`: AI Workshop and "Virtual Chief Engineer" Copilot.
  - `ethics/`: Ethics Sandbox and Violation Monitoring system.
  - `knowledge/`: Interactive Knowledge Graph.
  - `interactive-learning/`: Educational modules (PID, Physics Modeling, Control Map, Argument Principle).
  - `simulations/`: 3D Ship simulation environments (e.g., Destroyer Simulation).
  - `virtual-lab/`: Unified portal for all interactive experiments.
- **`src/components/`**: Modular UI components.
  - `ui/`: Base Shadcn/ui components.
  - `shared/`: Reusable business-level components.
  - Specialized directories for `ai`, `ethics`, `knowledge`, `simulation`, and `interactive-learning`.
- **`src/lib/`**: Core logic and utilities.
  - `simulation-engine.ts`: Mathematical models (Nomoto, PID, Wave logic).
  - `ai-client.ts` & `llm-client.ts`: AI configuration and prompt engineering.
  - `prisma.ts`: Database client.
  - `competency.ts`: OBE competency tracking logic.
- **`prisma/`**: Database schema and migrations.
- **`public/`**: Static assets, including 3D models (`.glb`) and legacy interactive HTML files.
- **`scripts/`**: Maintenance and seeding scripts (missions, admin setup, etc.).

---

## 📜 Development Standards & Conventions

**CRITICAL:** All development must strictly adhere to `docs/ai-project-spec.md`.

### Key Rules:
1.  **Strict Typing:** Mandatory TypeScript for all logic and component props.
2.  **UI Consistency:** Always use **Shadcn/ui** primitives. Custom CSS is forbidden; use Tailwind utility classes.
3.  **Data Fetching:** Prefer Server Components for initial data load. Use Zod for all API input validation.
4.  **AI Persona:** The AI assistant ("Virtual Chief Engineer") follows a specific expert persona defined in `src/lib/ai-client.ts`.
5.  **Simulation Logic:** Mathematical models in `src/lib` must be kept pure and decoupled from the UI where possible.

---

## 🚀 Quick Start & Commands

- **Development:** `npm run dev` (Starts Next.js dev server)
- **Build:** `npm run build`
- **Database:** `npx prisma studio` (To inspect data)
- **Seeding:** `npm run seed:missions` or `npm run seed:admin`
- **Testing:** `npm run test` (Smoke tests) or `npm run test:integration` (Playwright)

---

## 🧠 Memory Bank / Context

- **Objective:** Bridge the gap between abstract control theory and practical maritime engineering through AI-enhanced interactivity.
- **Current Focus:** Expanding the "Virtual Lab" and refining the integration between the "Ethics Sandbox" and the "Ship Simulation" to teach responsible automation.
- **Key Files for Reference:**
  - `src/lib/simulation-engine.ts`: The "brain" of the ship physics.
  - `src/lib/ai-client.ts`: Definition of the AI personality and analytical tools.
  - `prisma/schema.prisma`: The source of truth for missions, users, and ethics logs.

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

**IMPORTANT: In Codex, some `code-review-graph` tools are lazily exposed.**
If the current session only shows a subset of CRG tools, do **not** assume
the others are unavailable or removed upstream. First use `tool_search` with
queries such as `code-review-graph semantic_search_nodes query_graph
get_impact_radius get_affected_flows list_flows get_flow
get_architecture_overview list_communities refactor_tool` to load the
deferred schemas, then call the corresponding `mcp__code_review_graph__.*_tool`.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. Start with `get_minimal_context`.
2. If a needed CRG tool is missing from the current session, use `tool_search`
   to load it before falling back.
3. Use `detect_changes` for code review.
4. Use `get_affected_flows` to understand impact.
5. Use `query_graph` pattern="tests_for" to check coverage.
