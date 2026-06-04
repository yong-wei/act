# adaptive-learner-state-service Specification

## Purpose
Define the server-owned adaptive learner-state read model used by path planning, personalization, profile, and Konling consumers.
## Requirements
### Requirement: Learner state is server-owned
The system SHALL provide a server-owned Learner State Service for adaptive-learning consumers.

#### Scenario: Path planner requests learner state
- **WHEN** the path planner requests learner state for a student
- **THEN** the service SHALL return primary competency state, second-level competency state, knowledge mastery, resource preference, media absorption, risks, path context, evidence windows, and confidence markers
- **AND** missing, stale, partial, or low-confidence evidence SHALL be explicit.

#### Scenario: Client sends profile hints
- **WHEN** a client sends profile-like values to an AI or path endpoint
- **THEN** the server SHALL treat them as hints only
- **AND** authoritative adaptive state SHALL come from the Learner State Service.

### Requirement: Learner state retains and extends competency dimensions
The system SHALL retain the current six primary competency dimensions while adding second-level dimensions.

#### Scenario: Learner state is returned
- **WHEN** learner state is read
- **THEN** it SHALL include `controlModeling`, `parameterDesign`, `crossDomainTransfer`, `engineeringDecision`, `inquiryReflection`, and `selfDirectedLearning`
- **AND** it SHALL include second-level dimensions for concept mastery, time/frequency transfer, modeling reliability, tuning efficiency, constrained optimization, solution stability, cross-modal transfer, scenario generalization, risk recognition, constraint compliance, explanation quality, AI-use strategy, reflection depth, path execution, persistence, and remedial initiative where evidence exists.

### Requirement: Learner-state fields are quantified and scoped
The system SHALL declare quantification and privacy metadata for learner-state field families.

#### Scenario: Field family is added
- **WHEN** a learner-state field family is introduced
- **THEN** it SHALL declare value range, source families, algorithm version, evidence threshold, confidence policy, fallback reason, and privacy scope
- **AND** consumers SHALL NOT treat undeclared or low-confidence fields as high-confidence personalization state.

### Requirement: Learner state exposes the control-correction goal slice
The system SHALL expose a governed `control-correction` learner-state slice that can be consumed by path planning, Konling coaching, student UI, and teacher reports.

#### Scenario: Goal slice is requested
- **WHEN** an authorized student, teacher, or service requests learner state for `goal=control-correction`
- **THEN** the response SHALL include stable dimensions for time-domain analysis, root-locus reasoning, frequency-domain margin analysis, method selection, constraint tradeoff, simulation validation, Arena transfer, reflection, and AI-collaboration evidence
- **AND** each dimension SHALL include level, score or band, source coverage, evidence count, freshness, confidence, and privacy visibility metadata.

#### Scenario: Evidence is incomplete
- **WHEN** one or more control-correction dimensions lack sufficient governed evidence
- **THEN** the learner-state slice SHALL mark missing, stale, partial, or low-confidence dimensions explicitly
- **AND** it SHALL NOT present low-evidence dimensions as complete high-confidence mastery.

#### Scenario: Existing learner-state consumers read general state
- **WHEN** a consumer does not request the `control-correction` goal slice
- **THEN** existing learner-state payloads SHALL remain compatible
- **AND** the new goal slice SHALL NOT be required for unrelated adaptive-learning surfaces.

### Requirement: Learner state consumes registered goal slices
The Learner State Service SHALL resolve goal-specific read models through the adaptive goal-slice registry.

#### Scenario: Registered goal slice is read
- **WHEN** learner state is requested for a registered goal
- **THEN** the service SHALL return only dimensions and metadata declared by that goal contract
- **AND** it SHALL include confidence, source coverage, freshness, and privacy metadata for each visible field family.
- **AND** it SHALL preserve declared non-dimensional field families such as active path context, recent path rounds, terminal validation state, and no-active-path state when those families are part of the goal contract.

#### Scenario: Registered control-correction path context is read
- **WHEN** learner state is requested for `goal=control-correction`
- **THEN** the registered goal contract SHALL allow the active path id, status, current node, terminal validation state, and no-active-path state required by control-correction path consumers
- **AND** registry filtering SHALL NOT remove those fields merely because they are not competency dimensions.

#### Scenario: General learner state is read
- **WHEN** no goal is requested
- **THEN** existing general learner-state payloads SHALL remain compatible
- **AND** registered goal slices SHALL NOT be required for unrelated adaptive surfaces.

### Requirement: Learner state links to active control-correction path rounds
The system SHALL expose privacy-safe references from learner state to active or recent control-correction path rounds when authorized.

#### Scenario: Active path exists
- **WHEN** learner state is requested for `goal=control-correction` and an active path exists for the student
- **THEN** the learner-state payload SHALL include the active path id, status, current node, terminal validation state, and low-confidence markers needed by downstream consumers
- **AND** it SHALL NOT embed raw execution payloads or private Konling dialogue.

#### Scenario: No active path exists
- **WHEN** no active control-correction path exists
- **THEN** learner state SHALL expose an explicit no-active-path state
- **AND** path planning consumers SHALL be able to distinguish that state from a failed learner-state read.
