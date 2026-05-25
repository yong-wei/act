## ADDED Requirements

### Requirement: Adaptive-learning series enforces prerequisite gates
The system SHALL treat upstream virtual-simulation-platform-refactor contracts as prerequisites before adaptive-learning changes consume simulation or Arena data.

#### Scenario: Downstream change consumes simulation or Arena features
- **WHEN** a downstream adaptive-learning change reads simulation or Arena protocol, replay, evidence, resource, shell, or feature contracts
- **THEN** it SHALL verify the relevant prerequisite changes have no remaining tasks and pass strict validation
- **AND** it SHALL consume those contracts without redefining their trace, replay, registry, coverage, or evaluation semantics.

### Requirement: Adaptive-learning payloads declare privacy scope
The system SHALL classify adaptive-learning payload fields before exposing them through student, teacher, admin, or audit surfaces.

#### Scenario: New adaptive-learning payload is introduced
- **WHEN** a change adds a learner-state, assessment, ResourceNode, path, Konling, teacher-management, or evaluation payload
- **THEN** each field family SHALL declare student-visible, teacher-scoped, admin-scoped, audit-only, or system-internal visibility
- **AND** raw dialogue, raw answer bodies, hidden Arena evaluation internals, raw high-frequency traces, and private memory payloads SHALL default to restricted scopes.

### Requirement: Adaptive-learning evaluation events share an envelope
The system SHALL use a shared event envelope for adaptive-learning evaluation.

#### Scenario: Evaluation event is recorded
- **WHEN** learner-state, assessment, path, ResourceNode, Konling, teacher-management, or experiment activity is recorded for evaluation
- **THEN** the event SHALL include event type, actor, subject when applicable, related resource/path/session references, source capability, payload version, evidence confidence, privacy level, and timestamp
- **AND** it SHALL support privacy-safe aggregation without storing sensitive raw payloads.

### Requirement: Adaptive-learning features remain rollback-safe
The system SHALL keep existing profile, recommendation, classroom, resource, and chat surfaces operational while adaptive-learning services are introduced.

#### Scenario: Feature flag is disabled
- **WHEN** an adaptive-learning feature flag is disabled
- **THEN** the existing compatible surface SHALL remain available
- **AND** downstream changes SHALL document the fallback behavior and validation command for that surface.
