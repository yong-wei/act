## Purpose

Define the shared governance contracts for the XH-202620 adaptive-learning platform series, including prerequisite gates, privacy classification, evaluation-event envelope, rollback safety, and downstream handoff requirements.
## Requirements
### Requirement: Adaptive-learning series enforces prerequisite gates
The system SHALL treat upstream virtual-simulation-platform-refactor contracts as prerequisites before adaptive-learning changes consume simulation or Arena data.

#### Scenario: Downstream change consumes simulation or Arena features
- **WHEN** a downstream adaptive-learning change reads simulation or Arena protocol, replay, evidence, resource, shell, or feature contracts
- **THEN** it SHALL verify the relevant prerequisite changes have no remaining tasks and pass strict validation
- **AND** it SHALL consume those contracts without redefining their trace, replay, registry, coverage, or evaluation semantics.

#### Scenario: Prerequisite gate is checked
- **WHEN** an adaptive-learning change depends on simulation or Arena evidence
- **THEN** its implementation review SHALL confirm the following upstream contracts are archived, task-complete, and strict-valid:
  - `standardize-simulation-scene-and-trace-protocol`
  - `make-simulation-runtime-replayable`
  - `register-simulations-as-course-resources`
  - `unify-arena-preview-adapter-and-model-registry`
  - `split-simulation-scene-shells`
  - `govern-simulation-and-arena-evidence-sources`
  - `materialize-simulation-features-for-personalization`
- **AND** if one prerequisite is absent, active, failed, or only partially implemented, the downstream change SHALL stop or keep the dependent surface feature-flagged off.

### Requirement: Adaptive-learning payloads declare privacy scope
The system SHALL classify adaptive-learning payload fields before exposing them through student, teacher, admin, or audit surfaces.

#### Scenario: New adaptive-learning payload is introduced
- **WHEN** a change adds a learner-state, assessment, ResourceNode, path, Konling, teacher-management, or evaluation payload
- **THEN** each field family SHALL declare student-visible, teacher-scoped, admin-scoped, audit-only, or system-internal visibility
- **AND** raw dialogue, raw answer bodies, hidden Arena evaluation internals, raw high-frequency traces, and private memory payloads SHALL default to restricted scopes.

#### Scenario: Privacy level is assigned
- **WHEN** a field family is added to an adaptive-learning payload
- **THEN** it SHALL use one of these privacy classes:
  - `student-visible`: safe for the learner to inspect directly, including explanations, own progress, public resource metadata, and privacy-safe confidence markers
  - `teacher-scoped`: visible only to authorized teachers for their classes or resources, including aggregate evidence, risk flags, path constraints, and intervention summaries
  - `admin-scoped`: visible only to administrators for platform operations, data quality, model health, feature flags, and tenant-level governance
  - `audit-only`: retained for traceability or dispute review, not shown in ordinary product views, including raw scoring diagnostics and privileged access records
  - `system-internal`: used only inside services or workers, including prompt internals, private memory payloads, hidden Arena evaluator details, raw answer bodies, and raw trace payloads
- **AND** any field with mixed sensitivity SHALL use the most restrictive class until a redacted derivative is explicitly defined.

#### Scenario: Restricted data is redacted
- **WHEN** restricted payload data is exposed to a less-privileged role
- **THEN** the exposed value SHALL be an aggregate, summary, reference id, confidence marker, or reason code
- **AND** privileged reads of audit-only or system-internal payloads SHALL be attributable to a role, actor, subject, purpose, and timestamp.

### Requirement: Adaptive-learning evaluation events share an envelope
The system SHALL use a shared event envelope for adaptive-learning evaluation.

#### Scenario: Evaluation event is recorded
- **WHEN** learner-state, assessment, path, ResourceNode, Konling, teacher-management, or experiment activity is recorded for evaluation
- **THEN** the event SHALL include event type, actor, subject when applicable, related resource/path/session references, source capability, payload version, evidence confidence, privacy level, and timestamp
- **AND** it SHALL support privacy-safe aggregation without storing sensitive raw payloads.

#### Scenario: Evaluation event envelope is emitted
- **WHEN** a downstream adaptive-learning subsystem emits an evaluation event
- **THEN** the event SHALL declare `eventType`, `actor`, `subject`, `sourceCapability`, `payloadVersion`, `occurredAt`, `privacyLevel`, `confidence`, and `relatedRefs`
- **AND** `relatedRefs` SHALL use stable references such as `resourceNodeId`, `pathId`, `sessionId`, `assessmentAttemptId`, `learningFactId`, `interventionId`, `experimentId`, or `classId` rather than embedding sensitive raw payloads.

#### Scenario: Event confidence is computed
- **WHEN** an evaluation event is derived from learner state, assessment, simulation, Arena, ResourceNode, path, Konling, teacher-management, or experiment activity
- **THEN** it SHALL distinguish high-confidence assessed evidence, governed replay evidence, partial evidence, stale evidence, preview-only evidence, and missing evidence
- **AND** analytics SHALL aggregate by declared confidence state instead of treating all event families as equivalent.

### Requirement: Adaptive-learning features remain rollback-safe
The system SHALL keep existing profile, recommendation, classroom, resource, and chat surfaces operational while adaptive-learning services are introduced.

#### Scenario: Feature flag is disabled
- **WHEN** an adaptive-learning feature flag is disabled
- **THEN** the existing compatible surface SHALL remain available
- **AND** downstream changes SHALL document the fallback behavior and validation command for that surface.

#### Scenario: Feature flag is introduced
- **WHEN** a downstream change introduces adaptive assessment persistence, learner-state service, ResourceNode registry, path planning, Konling adaptive runtime, teacher management, or optimization experiments
- **THEN** it SHALL declare the controlling flag, default state, fallback route or service, migration/rollback behavior, and validation command
- **AND** disabling the flag SHALL not remove existing profile, recommendation, classroom, resource, assessment, or chat behavior.

### Requirement: Adaptive-learning handoffs include implementation contracts
The system SHALL require downstream adaptive-learning changes to include handoff artifacts before they can be reviewed as complete.

#### Scenario: Data model or API is added
- **WHEN** a downstream adaptive-learning change adds a persistent model, service API, event family, or cross-subsystem payload
- **THEN** it SHALL document the ER or ownership boundary, data dictionary, privacy class per field family, source of truth, retention expectation, and migration/rollback note
- **AND** it SHALL include at least one request/response or event example that uses the shared evaluation envelope where evaluation data is involved.

#### Scenario: Downstream proposal consumes this contract
- **WHEN** a downstream split proposal consumes shared privacy, evaluation, prerequisite, feature-flag, or rollback rules
- **THEN** the proposal or design SHALL explicitly reference `establish-adaptive-learning-governance-contracts`
- **AND** the downstream implementation SHALL not redefine those shared rules without modifying this contract first.

### Requirement: Control-correction learner-state fields are governed
The system SHALL govern control-correction learner-state fields through the shared adaptive-learning privacy, confidence, evaluation-event, and rollback contracts.

#### Scenario: Control-correction field family is introduced
- **WHEN** a control-correction learner-state field family is added
- **THEN** it SHALL declare student-visible, teacher-scoped, admin-scoped, audit-only, or system-internal visibility
- **AND** raw dialogue, raw answer bodies, hidden Arena evaluator internals, raw high-frequency traces, and private memory payloads SHALL remain restricted unless a redacted derivative is explicitly defined.

#### Scenario: Goal-slice evaluation event is emitted
- **WHEN** the control-correction learner-state slice is refreshed or read for evaluation
- **THEN** the evaluation event SHALL use the shared adaptive-learning envelope
- **AND** it SHALL include stable references, confidence state, source coverage, and privacy level rather than embedding sensitive raw payloads.

### Requirement: Path evidence emits governed evaluation events
The system SHALL emit shared adaptive-learning evaluation events for control-correction path execution, deviation, terminal validation, and intervention outcomes.

#### Scenario: Path event is emitted
- **WHEN** a path node starts, completes, fails, is abandoned, deviates, triggers fallback, reaches terminal validation, or records an intervention outcome
- **THEN** the event SHALL declare event type, actor, subject, source capability, payload version, occurred time, privacy level, confidence, and related path/resource/session references
- **AND** it SHALL use stable references rather than embedding raw execution payloads, raw dialogue, raw traces, or hidden Arena internals.

