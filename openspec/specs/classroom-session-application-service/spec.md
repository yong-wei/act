# classroom-session-application-service Specification

## Purpose

Define the Course/Classroom public API and application use cases that own
session lifecycle and access orchestration while preserving the existing route
behavior and transport boundaries.
## Requirements
### Requirement: Session operations have one public use-case surface

The system SHALL expose typed public use cases for create, join, read, advance,
end, access authorization, and stream policy. New Course/Classroom callers MUST
invoke these use cases rather than route-local ORM or policy helpers.

#### Scenario: A caller creates a session

- **WHEN** a teacher or administrator starts a classroom
- **THEN** the caller MUST invoke the create use case with actor, course/bundle,
  and operation input
- **AND** the result MUST include the same session identity and duplicate choice
  semantics as the current route.

#### Scenario: A caller reads or advances a session

- **WHEN** a classroom page reads progress or advances the active step
- **THEN** it MUST invoke the read/advance use case
- **AND** it MUST NOT duplicate transition or bundle-binding rules in the page.

### Requirement: Routes are delivery adapters only

App Router handlers SHALL limit themselves to authentication extraction, HTTP
input parsing, public-use-case invocation, and status/error/response mapping.
They MUST NOT own independent Prisma orchestration, session access policy, or
course identity resolution.

#### Scenario: An API route receives a request

- **WHEN** `/api/session`, `/api/session/join`, a session detail/state/stream
  route, or a teacher session route handles a request
- **THEN** it MUST map the request to one public use case
- **AND** equivalent inputs MUST receive the same domain decision regardless of
  which route delivered them.

#### Scenario: A route adds a new business branch

- **WHEN** a route needs a lifecycle, authorization, duplicate, or identity rule
- **THEN** the rule MUST be implemented in the application/use-case boundary
- **AND** a route-local alternative authority MUST fail architecture review.

### Requirement: Application and infrastructure boundaries are explicit

The application service SHALL depend on ports for session persistence, bundle
resolution, clock, event publication, and stream signaling. Prisma, Next,
Redis, SSE framing, and React MUST be isolated in adapters or delivery layers.

#### Scenario: The use-case unit suite runs

- **WHEN** application use cases are tested with fake ports
- **THEN** they MUST run without Prisma, Next, Redis, or React
- **AND** the tests MUST cover state transitions and access policy directly.

#### Scenario: A persistence or stream adapter is replaced

- **WHEN** the Prisma or SSE/poll adapter changes
- **THEN** the public use-case contract MUST remain stable
- **AND** no domain caller MUST import the adapter implementation.

### Requirement: Access policy is shared and behavior-preserving

All create, join, read, state, end, and stream operations SHALL use one
application-owned access decision that preserves the current teacher/admin
management, class-bound student membership, and explicitly documented legacy
classless behavior.

#### Scenario: An authorized actor accesses a session

- **WHEN** the actor is the managing teacher/admin or an eligible class member
- **THEN** the use case MUST authorize the operation according to the existing
  policy
- **AND** the route response MUST preserve the current success shape.

#### Scenario: An actor is not eligible

- **WHEN** the actor is outside the session's teacher/admin or class membership
- **THEN** the shared policy MUST deny the operation consistently
- **AND** all delivery routes MUST map the same denial to their characterized
  status and error contract.

### Requirement: Lifecycle and duplicate semantics remain stable

The application service SHALL preserve active/paused/finished transitions,
join-code and duplicate-session behavior, generated-courseware revision binding,
and the existing finalization ordering while extracting orchestration.

#### Scenario: A duplicate active session exists

- **WHEN** a create request finds an active duplicate under the current scope
- **THEN** the use case MUST return the existing duplicate decision and allowed
  actions
- **AND** it MUST not create a second session unless the explicit new-session
  action is valid.

#### Scenario: A session is ended twice

- **WHEN** end is requested for an already finished session
- **THEN** the use case MUST preserve the current idempotent/denied outcome
- **AND** it MUST not duplicate finalization work.

### Requirement: Stream policy is centralized

The stream use case/port SHALL own session access, update selection, heartbeat,
subscriber cleanup, and the existing Redis-to-poll fallback policy. SSE framing
remains a delivery adapter.

#### Scenario: The stream backend is available

- **WHEN** an authorized actor opens a session stream
- **THEN** the use case MUST authorize it and the adapter MUST emit the current
  session updates with the existing heartbeat behavior.

#### Scenario: The stream backend is unavailable

- **WHEN** Redis/subscription is unavailable
- **THEN** the adapter MUST use the characterized polling fallback
- **AND** the application access decision and session identity MUST remain the
  same.

### Requirement: Caller migration and deletion are denominator-closed

Every route, hook, page, report, governance reader, and test that invokes a
session operation SHALL be listed in a revision-bound caller ledger. A former
route/service authority MUST be deleted once its authoritative caller count is
zero; a permanent facade MUST NOT satisfy migration.

#### Scenario: A session operation is migrated

- **WHEN** all inventory callers for one operation use the public API
- **THEN** the old direct route/service authority MUST be removed
- **AND** the ledger MUST include zero-consumer evidence and the replacement.

#### Scenario: A dynamic caller is undiscovered

- **WHEN** static imports are zero but a browser or dynamic caller still invokes
  the old authority
- **THEN** migration MUST remain unqualified
- **AND** deletion MUST be blocked until that caller is migrated.

### Requirement: Session service verification includes domain and browser gates

The change SHALL include pure use-case tests, route/adapter contract tests,
database integration tests, stream tests, affected Classroom/Interactive tests,
and browser evidence for authorized and unauthorized flows.

#### Scenario: Browser lifecycle is exercised

- **WHEN** teacher and student create/join/read/advance/refresh/end a classroom
- **THEN** responses, access decisions, duplicate choices, and final status MUST
  match the characterization matrix
- **AND** a stream disconnect MUST preserve the existing fallback behavior.

#### Scenario: Strict validation is run

- **WHEN** `openspec validate extract-classroom-session-application-service
  --type change --strict` and `git diff --check` are run
- **THEN** the public API, ports/adapters, caller denominator, migration ledger,
  and verification evidence MUST be present and valid.

