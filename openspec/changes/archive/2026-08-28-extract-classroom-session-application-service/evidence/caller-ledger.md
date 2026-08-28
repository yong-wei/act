# Classroom session application-service ledger

Capture revision: working tree on `extract-classroom-session-application-service` (filled with commit SHA at archive).

| Operation | Old authority | Replacement | Callers migrated | Deletion / zero-consumer proof |
| --- | --- | --- | --- | --- |
| access | `src/lib/classroom-session-access.ts` | `authorizeClassroomSessionAccess` | session routes, classroom pages, simulation runs, interactive-event-ingestion, control-workbench-run-context, access tests | helper deleted; `rg classroom-session-access` has no remaining module imports |
| create | POST `/api/session` Prisma body | `createClassroomSession` + Prisma create runtime | HTTP route is auth/HTTP/error adapter via `create-api` | route no longer imports Prisma |
| join | GET `/api/session/join` Prisma body | `joinClassroomSession` + Prisma join runtime | HTTP route via `join-api`; join-entry tests read application source | route no longer imports Prisma |
| read | GET `/api/session/[sessionId]` | `readClassroomSession` | HTTP route via public API | Prisma/redis cache in lifecycle adapter |
| advance/end | PATCH `/api/session/[sessionId]` | `advanceClassroomSession` / `endClassroomSession` | HTTP route; attribution/finalization tests | finalization order stays in lifecycle adapter |
| stream | stream route inline access + Redis/poll | `openClassroomSessionStream` + stream policy + SSE adapter | `useSessionSSE` / `useSessionProgressChannel` remain HTTP clients of `/stream` | route no longer inlines membership; heartbeat/poll constants owned by stream policy |
| state | `/state` Prisma + duplicated canAccess/canManage | `read/writeClassroomSessionState` | HTTP route via `state-api`; session-state-route-auth tests | route no longer imports Prisma; teacher-sync/student-view semantics preserved |
| join-code | join-code route Prisma | `regenerateClassroomSessionJoinCode` | HTTP route | manage policy + ACTIVE guard in use case |
| pages | classroom teacher/student pages | `authorizeClassroomSessionAccess` | server pages keep Prisma reads for rendering but share access policy | no second access helper |
| reports / teacher session list | `/api/teacher/sessions` statistics | unchanged report readers | not a producer of the seven lifecycle operations | no session create/join/advance authority |
| governance | interactive-event-ingestion, control-workbench-run-context | shared `canAccessClassroomSession` | migrated imports | old helper deleted |

Static import proof for the deleted helper is the absence of `@/lib/classroom-session-access`. Dynamic/browser callers continue to use the same `/api/session*` URLs; hooks were not a second business authority.
