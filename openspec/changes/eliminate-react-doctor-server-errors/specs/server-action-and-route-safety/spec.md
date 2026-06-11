## ADDED Requirements

### Requirement: Exported Server Actions enforce authentication before side effects
The system SHALL ensure every exported Server Action that reads or mutates user-scoped, class-scoped, score, credit, progress, AI-history, or mission state performs explicit authentication before touching that state.

#### Scenario: Unauthenticated caller invokes a protected action
- **WHEN** an unauthenticated request invokes a protected exported Server Action directly
- **THEN** the action SHALL reject the request before reading or mutating protected state

#### Scenario: Authenticated caller invokes own scoped action
- **WHEN** an authenticated user invokes a protected Server Action for their own permitted scope
- **THEN** the action SHALL proceed using that authenticated user identity as the authoritative scope

#### Scenario: Authenticated caller supplies another user's scope
- **WHEN** an authenticated user invokes a protected Server Action with a caller-supplied `userId`, `simulationLogId`, history id, or equivalent scope that belongs to another user
- **THEN** the action SHALL reject the request before reading or mutating the other user's protected state

#### Scenario: Public leaderboard read is allowed
- **WHEN** an exported function intentionally exposes public leaderboard data
- **THEN** it SHALL return only public fields and SHALL NOT read private AI history, credit state, or user-scoped progress without authentication

### Requirement: GET route handlers are side-effect free
The system SHALL keep App Router GET handlers free of state creation, mutation, write-through statistics, cache mutation, or other persistent and cross-request side effects.

#### Scenario: Read request is prefetched or forged
- **WHEN** a GET route handler is invoked by browser prefetching, refresh, crawler access, or a forged cross-site request
- **THEN** the handler SHALL NOT create database records, mutate process-local accumulators, or update persistent state

#### Scenario: Client needs to create or mutate state
- **WHEN** a client needs to create a session, write telemetry, update statistics, or trigger another side effect
- **THEN** the system SHALL expose that operation through an authenticated POST or equivalent non-GET mutation path

### Requirement: Server module defaults do not leak mutable shared state
The system SHALL ensure server module-scope defaults used by actions or handlers cannot be mutated as shared request state.

#### Scenario: Request initializes default state
- **WHEN** a request initializes default unlocks, controller levels, ordering, or similar state from a module-level default
- **THEN** the request SHALL receive an isolated copy or immutable read-only structure

#### Scenario: Business logic mutates request state
- **WHEN** business logic mutates request-local progress, controller, or mission state
- **THEN** the mutation SHALL NOT alter a module-level default visible to another request

### Requirement: React Doctor server error scan is a local acceptance gate
The system SHALL provide a local validation path that proves the service-side React Doctor error rules covered by this change are clean.

#### Scenario: Developer validates server error cleanup
- **WHEN** a developer runs the documented local React Doctor 0.5.1 error-only command
- **THEN** the report SHALL contain no `server-auth-actions`, `nextjs-no-side-effect-in-get-handler`, or `server-no-mutable-module-state` diagnostics
