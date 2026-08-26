## Why

Classroom create, join, read, advance, end, access, and SSE policy is distributed across App Router handlers, `src/lib` helpers, hooks, and course pages. The duplication makes authorization, duplicate-session handling, lesson snapshotting, and lifecycle semantics drift even when each route appears locally correct.

## What Changes

- Establish a Course/Classroom public API with application use cases and ports for create, join, read, advance, end, access, and stream policy.
- Move orchestration and shared authorization/lifecycle decisions behind the application service while keeping Prisma, Next, SSE, and other delivery concerns in adapters.
- Reduce route handlers to HTTP parsing, authentication mapping, status/error mapping, and invocation of the public use case.
- Migrate real teacher, student, classroom, interactive-course, lesson-plan, and data-governance callers, then delete scattered route/service authorities rather than adding permanent facades.
- Preserve current access policy, duplicate-session semantics, generated-courseware identity binding, SSE/poll fallback behavior, and response compatibility unless a later contract explicitly changes them.

## Capabilities

### New Capabilities

- `classroom-session-application-service`: Defines public session use cases, ports/adapters, shared access policy, route mapping, and caller migration/deletion rules.

### Modified Capabilities

None. `audit-remediation-teacher-classroom-lifecycle`, `session-governance-readiness`, `session-finalization-quality`, `session-quality-status`, and `server-action-and-route-safety` remain the behavioral authorities.

## Impact

- Affects `/api/session`, `/api/session/join`, `/api/session/[sessionId]`, `/state`, `/stream`, teacher session routes, classroom pages, `src/lib/classroom-session-access.ts`, `src/lib/session-class-binding.ts`, `src/lib/session-lesson-snapshot.ts`, lifecycle/finalization helpers, and session hooks.
- Denominator: every producer and consumer of the seven session operations, including route tests, interactive entry shells, student/teacher pages, SSE clients, classroom reports, and governance ingestion. The inventory must reconcile static imports, dynamic route calls, and browser entry points at one captured revision.
- Depends on `define-course-bundle-classroom-session-contract`; the application service must consume its immutable bundle/session binding and the qualified modular-domain dependency contracts.

## Scope and Evidence

- **Characterization:** freeze status transitions, actor-role authorization, class-bound access, duplicate handling, error/status payloads, session snapshot fields, SSE heartbeat and poll fallback, and finalization order before extraction.
- **Migration and deletion:** migrate one operation and its callers at a time through the public API, delete direct route-to-ORM/service authority after the caller denominator reaches zero, and record each removed path in a retirement ledger. No behavior-changing policy rewrite.
- **Verification:** run route contract and authorization tests, application-service unit tests without Prisma, adapter/integration tests with the existing database contract, SSE/stream tests, affected classroom tests, typecheck, and strict OpenSpec validation.
- **Browser acceptance:** teacher creates/enters/ends a class, student joins and follows teacher progress, unauthorized users are rejected, duplicate-session choices remain unchanged, and stream disconnect falls back as before.
- **Ledger:** track operation, route, caller, policy owner, adapter, characterization fingerprint, migration status, and deletion proof. Do not claim implementation, deployment, or issue coordination in this proposal.
