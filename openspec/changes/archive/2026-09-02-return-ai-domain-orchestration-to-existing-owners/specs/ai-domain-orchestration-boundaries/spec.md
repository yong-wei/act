## ADDED Requirements

### Requirement: Domain owners remain the authority for AI-triggered business actions

AI-triggered business reads and writes SHALL be executed through the existing chartered domain owner public API or application use case; the AI runtime SHALL not become a second owner of domain facts or state machines.

#### Scenario: A model proposes a domain action

- **WHEN** AI output suggests an assessment, course, path, learning-record, Arena, knowledge, assignment, or publication action
- **THEN** the relevant domain owner SHALL validate and execute the action
- **AND** the AI runtime SHALL not persist or activate the suggestion directly.

#### Scenario: A domain contract is unavailable

- **WHEN** no authorized public/application contract can validate an AI-triggered action
- **THEN** the action SHALL return an explicit unavailable or advisory-only state
- **AND** a new AI-local business implementation SHALL not be created as a fallback.

### Requirement: Cross-domain AI callers use explicit boundaries

AI routes, tools, and workflows SHALL cross domains only through public APIs, application use cases, or declared infrastructure-neutral ports and SHALL not import domain internals, Prisma models, route handlers, or sibling private files.

#### Scenario: An AI route needs a learner or course fact

- **WHEN** an AI route or tool requests a fact owned by another domain
- **THEN** it SHALL consume the owner-provided read model or application contract
- **AND** the dependency graph SHALL record the owner and boundary.

#### Scenario: A deep import is proposed

- **WHEN** an AI production file imports another domain's implementation path
- **THEN** architecture qualification SHALL fail or require migration to an explicit boundary
- **AND** a shared AI helper SHALL not mask the deep import.

### Requirement: AI context and tool intents are bounded and non-authoritative

AI context SHALL contain only server-authorized, scope-bound owner projections; model output SHALL be represented as advisory content or a validated tool intent with provenance, revision, permission and idempotency metadata.

#### Scenario: Client supplies a broader scope

- **WHEN** a client supplies another user, class, course, resource, path, revision, or evidence identifier
- **THEN** the server SHALL reject or ignore the unverified value before model invocation or owner write
- **AND** the AI context SHALL remain within the server-resolved scope.

#### Scenario: Tool intent lacks owner evidence

- **WHEN** a tool intent lacks the required scope, revision, provenance, authorization, or idempotency binding
- **THEN** the owner SHALL reject it
- **AND** no domain fact, event, memory, or publication state SHALL be created.

### Requirement: Owner lifecycle and concurrency semantics are preserved

Returning orchestration to canonical owners SHALL preserve owner-defined validation, state transitions, optimistic revision checks, idempotency, audit, error and retry semantics.

#### Scenario: A write is retried

- **WHEN** the same authorized AI-triggered action is retried with the same owner-scoped idempotency key
- **THEN** the owner SHALL reuse or reject the existing result according to its contract
- **AND** the AI layer SHALL not create a duplicate side effect.

#### Scenario: Owner revision changes during an AI action

- **WHEN** the underlying domain revision changes before a write is committed
- **THEN** the owner SHALL return its conflict or stale-revision state
- **AND** the AI runtime SHALL not overwrite the newer domain state.

### Requirement: Platform, delivery and security boundaries remain singular

The change SHALL retain the existing PlatformSetting configuration authority, AppShell and role projections, SSR/R3F boundary, ingress schema/timeout/privacy contracts, and release/rollback unique security validator.

#### Scenario: An AI migration crosses delivery code

- **WHEN** a route or workflow moves to a domain owner
- **THEN** authentication, authorization, rendering, timeout, privacy and release/rollback validation SHALL remain at their existing boundaries
- **AND** the AI layer SHALL not introduce a second shell or gate.
