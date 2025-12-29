# Development Plan (Unified Platform)

## Goals
- Use `act.just.edu.cn/` as the single product base for the web experience.
- Merge authentication and database layers from `my-next-app/` into `act.just.edu.cn/`.
- Standardize on Postgres for multi-user, concurrent access.
- Focus exclusively on 自动控制原理 learning; no multi-course or cross-discipline scope.
- Develop simulation and LLM capabilities as separate services, with initial local dev and later server deployment.
- Keep boundaries flexible until early prototype testing clarifies performance and data needs.

## Key Decisions
- Frontend and API: Next.js 14 (App Router) in `act.just.edu.cn/`.
- Auth: NextAuth (with Prisma adapter).
- Database: Postgres via Prisma.
- External services: Simulation service and LLM service exposed via HTTP APIs, called from Next.js server routes.
- Course model: single course only; track learning modules/chapters instead of multiple courses.

## Target Architecture
```
act.just.edu.cn/ (Next.js 14)
  src/app/        - UI routes, server components, route handlers
  src/components/ - Shared UI
  src/lib/        - API clients, auth helpers, data access
  prisma/         - schema.prisma, migrations

simulation-service/ (separate repo or folder later)
  HTTP API for simulation jobs and results

llm-service/ (separate repo or folder later)
  HTTP API for chat, tutoring, content generation
```

## Data Model Draft (Prisma)
- User
  - id, email, name, role (student, teacher, admin)
- StudentProfile
  - userId, major, year, class
- SimulationSession
  - id, userId, module, simType, inputParams, outputSummary, createdAt
- LlmSession
  - id, userId, module, threadId, summary, createdAt
- Artifact
  - id, userId, module, type, storageRef, createdAt

## Service Boundaries (Initial Contract)
Simulation service
- POST /simulate
  - Request: { simType, inputParams, contextId? }
  - Response: { status, outputData, artifacts? }
- POST /simulate/async
  - Response: { jobId }
- GET /simulate/jobs/:jobId
  - Response: { status, outputData, artifacts? }

LLM service
- POST /llm/chat
  - Request: { threadId?, messages, contextId?, policy? }
  - Response: { threadId, assistantMessage, tokensUsed? }
- POST /llm/summary
  - Request: { source, goals }
  - Response: { summary }

Notes
- Exact boundaries may shift after performance profiling and data flow testing.
- Use API keys or signed JWT for service-to-service auth.

## Integration Plan (act.just.edu.cn/)
1. Add Prisma and NextAuth
   - Install Prisma, @auth/prisma-adapter, next-auth.
   - Create `prisma/schema.prisma` and migrate from `my-next-app/prisma/schema.prisma`.
   - Convert datasource to Postgres.
2. Configure environment
   - `DATABASE_URL=postgresql://...`
   - `NEXTAUTH_URL=...`
   - `NEXTAUTH_SECRET=...`
   - `SIM_SERVICE_URL=...`
   - `LLM_SERVICE_URL=...`
3. Implement auth routes and session helpers
   - `/api/auth/[...nextauth]` route handler
   - `src/lib/auth.ts` for server session utilities
4. Add protected routes and role checks
   - Middleware for student/teacher areas
5. Add API clients for services
   - `src/lib/simulation-client.ts`
   - `src/lib/llm-client.ts`

## Local Operations
- One-click scripts live in `scripts/`:
  - `scripts/start.sh` starts Postgres (Docker), optional service commands, and Next.js.
  - `scripts/stop.sh` stops processes and removes the Postgres container.
- Logs are written to `.logs/` for frontend, backend, console, and database.
- Optional backend commands can be provided via `SIM_SERVICE_CMD`/`LLM_SERVICE_CMD` and their working dirs via `SIM_SERVICE_DIR`/`LLM_SERVICE_DIR`.

## Migration Notes
- Move or re-create any auth-related pages from `my-next-app/` in `act.just.edu.cn/`.
- Preserve UI and pages already in `act.just.edu.cn/` and extend with login flow and user dashboard.
- Keep `my-next-app/` and `my-react-app/` as references until the unified app stabilizes.

## Milestones
1. Auth + Postgres baseline
   - Sign in/out, session, user stored in Postgres
2. Service integration skeleton
   - Basic calls to local simulation/LLM services
3. First end-to-end flow
   - Student login -> run simulation -> summarize with LLM -> store session

## Open Questions
- Simulation payload size and storage strategy (DB vs object storage).
- LLM request policy (prompt templates, caching, cost controls).
- Async job orchestration (queue vs simple polling).
