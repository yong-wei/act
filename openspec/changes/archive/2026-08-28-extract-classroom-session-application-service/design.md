## Context

Session behavior is currently spread across `/api/session`, `/api/session/join`,
`/api/session/[sessionId]`, its state and stream routes, teacher session routes,
`src/lib/classroom-session-access.ts`, `session-class-binding.ts`,
`session-lesson-snapshot.ts`, finalization helpers, and the interactive session
hooks. The routes perform mixtures of authentication, Prisma reads/writes,
duplicate-session decisions, access checks, progress mutation, and SSE/poll
fallback. The current `canAccessClassroomSession` policy is consumed by several
routes and pages, so a local change can alter another surface without an API
signature changing.

The application-service change follows the qualified bundle/session identity
contract. It is a Course/Classroom boundary, not a new transport or a rewrite of
authorization policy. Existing `audit-remediation-teacher-classroom-lifecycle`,
`session-finalization-quality`, `session-governance-readiness`,
`session-quality-status`, and `server-action-and-route-safety` remain the
behavioral authorities.

## Goals / Non-Goals

**Goals:**

- Expose one public API for create, join, read, advance, end, access, and stream
  policy.
- Keep application use cases independent from Next, Prisma, SSE, Redis, and
  React through ports and adapters.
- Preserve current actor-role, class-bound, duplicate-session, status/error,
  snapshot, finalization, and stream fallback behavior.
- Migrate real callers and delete scattered authorities once their denominator
  reaches zero.
- Make the captured CourseBundle revision an input/output of the create/read
  use cases rather than a route-local lookup.

**Non-Goals:**

- Changing who may create, join, advance, read, or end a session.
- Replacing HTTP routes, SSE, Redis, or database technology.
- Moving student evidence semantics (owned by the live/evidence change).
- Creating a permanent compatibility facade or a second access-policy helper.
- Changing teacher class-choice behavior from `add-default-teacher-class-launch-selection`.

## Decisions

### 1. Use one public API with explicit use cases

Create a Course/Classroom public API whose use-case surface is explicit:
`createClassroomSession`, `joinClassroomSession`, `readClassroomSession`,
`advanceClassroomSession`, `endClassroomSession`,
`authorizeClassroomSessionAccess`, and `openClassroomSessionStream`. Each
accepts a typed actor, captured course/bundle identity, and operation-specific
input; each returns a typed result or a stable domain error code.

The public API is the only cross-domain entry for new callers. Generic route
helpers with overloaded optional parameters were rejected because they conceal
which policy is applied and encourage direct Prisma access.

### 2. Separate application, ports, and adapters

Use the repository's modular-domain direction:

```text
App Router route / classroom feature
  -> classroom public-api / application use case
  -> ports (session repository, bundle resolver, clock, event publisher)
  -> Prisma / Redis / Next-auth / SSE adapters
```

The application layer owns state-transition validation, the shared access
policy, duplicate-session decision, bundle binding, and finalization ordering.
The Prisma adapter owns transactions and query shapes; the route adapter owns
HTTP/auth/status mapping; the stream adapter owns SSE framing, heartbeat,
subscriber cleanup, and polling fallback. No domain core file imports Next,
Prisma, or React.

### 3. Preserve exact route semantics at a compatibility boundary

During migration, each route keeps its existing URL, authentication extraction,
status code, error payload, and response fields. It maps its request to one
use-case input and maps the domain result back to the existing response. The
compatibility mapping is time-bounded and recorded in the ledger; it is not a
second business implementation.

The route may continue to distinguish administrator temporary sessions and
teacher class-bound sessions according to the existing lifecycle contract. It
must not silently infer a bundle, class, or actor from a title or profile when
the use case requires an explicit value.

### 4. Centralize access policy without broadening it

Move the semantics currently represented by `canManageClassroomSession` and
`canAccessClassroomSession` into one application policy port/use case. The
policy must preserve teacher/admin management, class-bound student membership,
and the existing classless compatibility behavior until the upstream contract
changes it. All state, join, read, and stream operations call the same policy
decision and emit a consistent denial code.

Duplicating policy in each route was rejected. A new generalized authorization
framework was also rejected because it would change scope without evidence of a
missing capability.

### 5. Migrate operation-by-operation, then delete authorities

Use a producer/consumer inventory to migrate create first, then join/read,
advance, end, access, and stream. Each operation must have route, hook, page,
report, and test callers moved before its old helper is deleted. Once an old
route/service function has zero authoritative callers, remove it in the same
qualified migration slice; do not leave a permanent re-export.

The application service consumes the immutable CourseBundle binding but does
not own manifest rendering or evidence materialization. Those remain explicit
ports/capabilities for later changes.

## Denominator and Characterization

Freeze all seven operation surfaces: route handlers and tests, interactive
entry shells, classroom teacher/student pages, `useSessionProgressChannel`,
`useSessionSSE`, state hooks, duplicate-session callers, finalization/report
readers, and governance ingestion. Record actor roles, route statuses, errors,
state transitions, join-code behavior, SSE heartbeat/poll timing, and bundle
identity fields at one source revision. Static imports and browser entry points
must reconcile; neither alone is a complete denominator.

## Vertical Migration and Deletion

Start with a read-only route and its tests to establish the adapter seam, then
migrate create/join/mutation/stream in small vertical slices. Keep the old
mapping only while a caller remains; after the inventory reports zero direct
authority, delete the old route/service branch and update the ledger. Rollback
uses the route mapping to the same use case and does not restore an old policy
implementation.

## Targeted and Domain Verification

Run application-service pure unit tests for all use cases and policy branches,
route contract tests for status/error/response compatibility, adapter tests with
the existing real-PostgreSQL transaction contract, join-code and duplicate
session tests, SSE heartbeat/disconnect/poll tests, and finalization tests.
Then run affected Classroom/Interactive domain suites, typecheck, and
`openspec validate extract-classroom-session-application-service --type change
--strict`, followed by `git diff --check`.

## Browser Acceptance

Use a teacher, an authorized student, a wrong-class student, and an admin.
Create or reuse a session, join, advance through at least two steps, refresh,
end it, and inspect the final status. Disconnect the stream to exercise polling
fallback and verify that duplicate-session choices, denial screens, and
generated-courseware identity remain unchanged.

## Ledger

Record each operation, route, caller, policy decision, port, adapter, response
fingerprint, migration revision, old authority, deletion condition, and focused
test/browser evidence. The ledger must distinguish route delivery from the
application owner and must not claim a route is retired while a dynamic caller
or browser entry remains.

## Migration Plan

1. Verify `define-course-bundle-classroom-session-contract` and the qualified
   modular charter/dependency contract.
2. Characterize and freeze the operation denominator and compatibility
   fingerprints.
3. Implement public API, use cases, ports, and adapters without changing route
   behavior.
4. Migrate route/page/hook/report callers operation-by-operation; remove direct
   Prisma and policy authority after zero-consumer checks.
5. Hand the stable lifecycle seam to the live/evidence change and record the
   final caller/deletion ledger.

Rollback is a caller-level switch to the previous route mapping while preserving
the same persisted session rows and immutable bundle bindings. It does not
reintroduce a parallel policy after the new use case has become authoritative.

## Open Questions

None blocking. The concrete module directory may follow the repository's
qualified domain layout, but all new cross-domain callers must use the public API
and all delivery adapters must preserve the observed route contract.
