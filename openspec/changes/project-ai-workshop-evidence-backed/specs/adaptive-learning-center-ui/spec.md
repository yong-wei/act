## MODIFIED Requirements

### Requirement: Existing adaptive routes remain compatible
The system SHALL keep existing adaptive and AI surfaces operational during migration. `/ai` SHALL render the existing AI Workshop and preserve task intent while sourcing learner-facing state from the server-owned evidence projection.

#### Scenario: AI Workshop is opened without task intent
- **WHEN** an authenticated learner opens `/ai`
- **THEN** the route SHALL render the AI Workshop with an evidence-backed available, empty, or unavailable state
- **AND** it SHALL not render sample learner data as current personal data.

#### Scenario: AI Workshop is opened with report-feedback intent
- **WHEN** an authenticated learner opens `/ai?task=report-feedback`
- **THEN** the route SHALL preserve the report-feedback task candidate workflow
- **AND** the surrounding learner panels SHALL still use the evidence-backed projection.

### Requirement: Learner data empty states are actionable
The adaptive learning center SHALL render empty, stale, low-confidence, and no-data states as complete learner-facing states.

#### Scenario: AI Workshop has no verified records
- **WHEN** the AI Workshop receives an empty projection or an empty governed collection
- **THEN** the relevant panel SHALL state that no verified record is available
- **AND** it SHALL provide an adjacent learning or evidence-creation action
- **AND** it SHALL not show a fabricated zero, locked achievement list, or sample record.

### Requirement: Adaptive claims expose confidence and evidence limits
The system SHALL represent source coverage, confidence, privacy scope, and evidence limitations in product language for students and diagnostic language only for authorized teacher/admin surfaces.

#### Scenario: AI Workshop evidence is stale or partial
- **WHEN** the learner-state projection contains stale, partial, or low-confidence markers
- **THEN** the student UI SHALL display a readable limitation
- **AND** it SHALL not present the projection as a complete personal portrait.
