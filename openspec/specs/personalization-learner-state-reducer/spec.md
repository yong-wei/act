# personalization-learner-state-reducer Specification

## Purpose
Define the Personalization-owned pure learner-state reducer, owned Learning Record and Assessment read ports, and single public API that replaces the old data-governance service authority.
## Requirements
### Requirement: Learner state is computed by a pure reducer

Personalization SHALL expose a deterministic `LearnerStateReducer` that accepts normalized Learning Record and Assessment read-port inputs, goal/plugin context, role scope, algorithm version and evaluation time. The reducer MUST NOT read Prisma, Next, React, raw client hints, queues, or write persistent state.

#### Scenario: Same governed input is reduced twice

- **WHEN** the reducer receives the same facts, assessment outcomes, policy versions and evaluation time
- **THEN** it SHALL return the same learner-state values, confidence, freshness and limitation metadata
- **AND** it SHALL not issue I/O or mutate the input.

#### Scenario: Evidence is missing or stale

- **WHEN** read-port input lacks a required source, is stale, partial or low confidence
- **THEN** the reducer SHALL return an explicit limitation/no-evidence state
- **AND** it SHALL not synthesize high-confidence mastery or a complete diagnosis.

### Requirement: Learner-state inputs come through owned read ports

The application layer SHALL obtain learner facts and snapshots through the Learning Record read port and assessment outcomes/mastery through the Assessment read port. Personalization MUST NOT query raw Prisma tables or reconstruct authoritative facts from route payloads, profile summaries or model narratives.

#### Scenario: Personalization reads assessment evidence

- **WHEN** learner state needs assessment-backed mastery or an ability estimate
- **THEN** the application SHALL request the durable Assessment read projection
- **AND** the reducer SHALL retain its source, algorithm version, confidence and immutable reference.

#### Scenario: A client supplies profile values

- **WHEN** a client sends a learner-state or profile hint
- **THEN** the application SHALL treat it as non-authoritative context
- **AND** the reducer SHALL not use it to replace Learning Record or Assessment evidence.

### Requirement: One public boundary serves role and goal projections

Personalization SHALL provide one server-owned learner-state public API that projects student, teacher, admin and system views from the reducer result. Alternate convenience functions MAY map the public DTO but MUST NOT implement a second reducer or bypass role, privacy and confidence policies.

#### Scenario: Authorized consumer requests a goal projection

- **WHEN** a student, teacher, admin or service requests a registered goal projection
- **THEN** the public API SHALL authorize the subject and role scope before reading ports
- **AND** it SHALL return only fields declared by the goal and privacy contracts with confidence/source metadata.

#### Scenario: Goal has no registered plugin context

- **WHEN** a requested goal is not registered or its plugin context is unavailable
- **THEN** the public API SHALL return an explicit unsupported/limited state
- **AND** it SHALL not fall back to course-specific constants or a second goal implementation.

### Requirement: Reducer preserves evidence authority and privacy invariants

The reducer and projector SHALL preserve portrait v2, assessment-backed mastery confidence, LearningFact identity/revision, evidence freshness, no-data/unavailable distinction and canonical privacy scopes. Browsing, passive views, prompts and unverified intervention narratives MUST NOT grant high-confidence mastery.

#### Scenario: Non-assessment activity is present

- **WHEN** browsing, navigation, passive media views or unverified assistance appears in the Learning Record input
- **THEN** it MAY contribute context or a remediation signal according to policy
- **AND** it SHALL not by itself create high-confidence mastery or unlock a hard path gate.

#### Scenario: Student-facing projection is returned

- **WHEN** a student-facing learner state is projected
- **THEN** it SHALL expose only student-visible summaries, confidence, freshness and safe source references
- **AND** teacher-scoped, audit-only, system-internal and raw answer payloads SHALL remain restricted.

### Requirement: Legacy learner-state authority is removed after migration

When all declared callers have migrated, the old `adaptive-learner-state-service` public authority, forwarding export and duplicate read path SHALL be deleted. The migration MUST leave no production import of the old authority while preserving old data tables and read adapters still owned by other domains.

#### Scenario: Caller migration is complete

- **WHEN** route, worker, profile, Konling, graph, recommendation and feature-cache callers use the new public API and their tests pass
- **THEN** the old service public entry SHALL be removed
- **AND** architecture evidence SHALL prove zero production imports or re-exports remain.

#### Scenario: A caller is not migrated

- **WHEN** a production caller still depends on the old learner-state authority
- **THEN** the change SHALL fail its deletion gate
- **AND** it SHALL not add a forwarding facade or silently delete the old path.

