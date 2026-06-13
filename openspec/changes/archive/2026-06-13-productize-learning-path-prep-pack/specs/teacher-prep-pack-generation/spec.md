## MODIFIED Requirements

### Requirement: Prep packs convert diagnosis into teacher actions
Prep packs SHALL be accessible from teacher diagnosis surfaces as reviewable interventions.

#### Scenario: Prep pack is generated
- **WHEN** a teacher generates a prep pack from class diagnosis
- **THEN** each candidate SHALL include source diagnosis evidence, target class or lesson context, insertion target, evidence citations, expected learner impact, and teacher review state
- **AND** unsupported candidates SHALL become draft-resource requests that require review.

### Requirement: Teacher review gates publication
Teacher review SHALL provide visible approve, reject, edit, preview, activate, rollback, and archive states.

#### Scenario: Teacher reviews a prep item
- **WHEN** a teacher opens a prep-pack review surface
- **THEN** the UI SHALL show candidate rationale, source evidence, insertion target, runtime diff, allowed actions, and current lifecycle state
- **AND** only approved items SHALL be eligible for activation.

### Requirement: Runtime overlays are teacher-activated and reversible
Runtime overlays SHALL remain scoped, auditable, and non-mutating.

#### Scenario: Pack is activated
- **WHEN** a teacher activates an approved enhancement pack
- **THEN** active overlay items SHALL be scoped to the intended class, class session, lesson, and insertion anchors
- **AND** the base runtime manifest SHALL NOT be mutated.

#### Scenario: Pack is rolled back
- **WHEN** a teacher rolls back an active enhancement pack
- **THEN** overlay items SHALL disappear from the merged runtime view
- **AND** activation, rollback, and impact evidence history SHALL remain auditable.

### Requirement: Enhancement impact is traceable
Prep-pack impact SHALL be available to effect-report and teacher reflection workflows.

#### Scenario: Post-class evidence is collected
- **WHEN** learners interact with activated overlay items
- **THEN** the system SHALL record impact evidence linked to pack id, item id, lesson/session scope, and source diagnosis
- **AND** effect-report code SHALL be able to aggregate impact without raw private evidence.
