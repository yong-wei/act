## 1. Preconditions and operation denominator

- [x] 1.1 Verify `define-course-bundle-classroom-session-contract` and the qualified charter/dependency contract, including bundle identity and route ownership inputs.
- [x] 1.2 Freeze the seven-operation denominator: create, join, read, advance, end, access, and stream, including route handlers/tests, hooks, pages, reports, governance readers, and browser entry points.
- [x] 1.3 Characterize actor-role authorization, class-bound access, duplicate-session outcomes, status/error payloads, lifecycle transitions, snapshot fields, finalization order, SSE heartbeat, and poll fallback.

## 2. Public API and application boundary

- [x] 2.1 Define typed Course/Classroom public API contracts and domain error codes for all seven operations, including actor, bundle, session, and operation inputs.
- [x] 2.2 Implement application use cases for create/join/read/advance/end/access/stream policy with no direct Prisma, Next, Redis, SSE, or React dependency.
- [x] 2.3 Define ports for session repository, bundle resolver, clock, event publication, and stream signaling; document their transaction and identity invariants.
- [x] 2.4 Implement Prisma, auth, Redis/SSE, and poll-fallback adapters behind the ports while preserving existing transaction, access, and generated-courseware behavior.
- [x] 2.5 Centralize the current teacher/admin/class-member access policy and verify classless compatibility behavior remains explicit until a later contract changes it.

## 3. Route and caller migration

- [x] 3.1 Convert `/api/session`, `/api/session/join`, `/api/session/[sessionId]`, state, stream, and teacher session routes to HTTP/auth/status adapters that invoke one use case each.
- [x] 3.2 Migrate interactive entry shells, classroom teacher/student pages, `useSessionProgressChannel`, `useSessionSSE`, finalization/report readers, and governance ingestion to the public API.
- [x] 3.3 Preserve duplicate-session choices, join-code semantics, bundle/session binding, lifecycle transitions, response fields, and error statuses using characterization fixtures.
- [x] 3.4 Delete direct route-to-ORM/policy/service authorities once each operation's static, dynamic, test, and browser caller denominator reaches zero; do not add a permanent facade.
- [x] 3.5 Record operation, route, caller, port, adapter, old authority, replacement, deletion condition, and zero-consumer proof in the application-service ledger.

## 4. Vertical migration and deletion verification

- [x] 4.1 Migrate one read operation and its tests first, then create/join/mutation/end/access/stream in dependency order with a reversible route mapping.
- [x] 4.2 Add pure use-case tests for successful, unauthorized, class-bound, duplicate, stale-bundle, invalid-transition, and idempotent-end cases.
- [x] 4.3 Add route/adapter contract and real-PostgreSQL integration tests for authorization, session writes, generated-courseware binding, join codes, and duplicate races.
- [x] 4.4 Add stream tests for access denial, update selection, heartbeat, disconnect cleanup, Redis path, and polling fallback.

## 5. Browser, domain, and strict gates

- [x] 5.1 Run teacher/admin/student/wrong-class browser journeys for create, join, read, advance, refresh, end, duplicate recovery, and stream disconnect.
- [x] 5.2 Run affected Classroom/Interactive/data-governance session suites and compare route/status/error fingerprints with the characterization receipt.
- [x] 5.3 Run typecheck and the repository's affected lint/build checks without changing `add-default-teacher-class-launch-selection` behavior.
- [x] 5.4 Run `openspec validate extract-classroom-session-application-service --type change --strict` and `git diff --check`; publish the qualified caller/deletion ledger for the live/evidence change.
