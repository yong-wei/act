## ADDED Requirements

### Requirement: Cruise-comfort uses the standard runtime-first course model
The system SHALL implement `/interactive-learning/courses/cruise-comfort-boppps` as a standard runtime-first interactive course.

#### Scenario: Cruise route keeps public address
- **WHEN** a user opens `/interactive-learning/courses/cruise-comfort-boppps`
- **THEN** the route SHALL remain available
- **AND** it SHALL load the rebuilt standard course implementation rather than the legacy classroom implementation.

#### Scenario: Cruise has a runtime manifest
- **WHEN** cruise-comfort course metadata is inspected
- **THEN** the course SHALL provide a runtime manifest with stable step ids and response-producing activity definitions
- **AND** the manifest SHALL be usable by the shared submission and evidence-spec machinery.

### Requirement: Cruise-comfort uses standard governance adapters
The rebuilt cruise-comfort course SHALL use the same submission evidence and finalization adapters as standard unit lessons.

#### Scenario: Cruise student submission uses manifest evidence
- **WHEN** a cruise-comfort student submits a response-producing step
- **THEN** the submission SHALL use `useManifestSubmissionController`
- **AND** persisted evidence SHALL use the `manifest-submission-v2` envelope.

#### Scenario: Cruise teacher finalization uses shared adapter
- **WHEN** a cruise-comfort teacher ends a session
- **THEN** finalization SHALL run through the unified shared finalization adapter
- **AND** the course SHALL expose captured, materialized, summarized, and cached closure phase status.

### Requirement: Legacy cruise classroom path is removed
The system SHALL not keep legacy cruise classroom code as a parallel implementation path.

#### Scenario: No legacy route classification remains
- **WHEN** session route and lesson snapshot helpers inspect `cruise-comfort-boppps`
- **THEN** they SHALL classify it as a standard course
- **AND** they SHALL NOT return a `legacy/cruise-comfort-boppps` lesson snapshot path.
