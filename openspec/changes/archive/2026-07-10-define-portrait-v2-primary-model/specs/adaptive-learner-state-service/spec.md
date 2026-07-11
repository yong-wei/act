## MODIFIED Requirements

### Requirement: Learner state retains and extends competency dimensions
The system SHALL expose portrait v2 as the primary learner portrait dimensions
while retaining legacy six-dimensional competency values only as
compatibility or migration metadata.

#### Scenario: Learner state is returned
- **WHEN** learner state is read after portrait v2 is available
- **THEN** it SHALL include the seven portrait v2 dimensions as the primary learner portrait
- **AND** any `controlModeling`, `parameterDesign`, `crossDomainTransfer`, `engineeringDecision`, `inquiryReflection`, or `selfDirectedLearning` values SHALL be marked as legacy compatibility or migration inputs rather than primary dimensions.
- **AND** it SHALL include second-level dimensions for concept mastery, time/frequency transfer, modeling reliability, tuning efficiency, constrained optimization, solution stability, cross-modal transfer, scenario generalization, risk recognition, constraint compliance, explanation quality, AI-use strategy, reflection depth, path execution, persistence, and remedial initiative where evidence exists.

## ADDED Requirements

### Requirement: Learner portrait state uses portrait v2 as primary model
The learner-state service SHALL expose a canonical seven-dimensional portrait
v2 payload as the primary learner portrait.

#### Scenario: Portrait v2 state is read
- **WHEN** the learner-state service returns current portrait data
- **THEN** it SHALL include all seven portrait v2 dimensions with score, confidence, freshness, evidence counts, source lineage, and calculation version
- **AND** it SHALL identify any migrated legacy values with limitation metadata.

#### Scenario: Legacy portrait state exists
- **WHEN** only legacy six-dimensional snapshot data exists for a learner
- **THEN** the service MAY derive portrait v2 compatibility values
- **AND** it SHALL mark the result as migrated or compatibility-derived rather than native portrait v2 evidence.

### Requirement: Portrait source lineage is privacy scoped
The learner-state service SHALL keep portrait source lineage auditable without
leaking raw or unauthorized evidence to learner-facing or AI-facing consumers.

#### Scenario: Learner-facing portrait is returned
- **WHEN** portrait v2 data is returned to a student-facing profile, Konling, or planner consumer
- **THEN** source lineage SHALL be redacted to allowed evidence-family, citation, aggregate, or hashed refs
- **AND** raw source payloads, teacher-scoped refs, private fixture refs, and migration-source snapshot ids SHALL NOT be exposed unless the caller is authorized for that evidence scope.

#### Scenario: Reviewer or administrator audits lineage
- **WHEN** an authorized reviewer or administrator requests audit details
- **THEN** the system MAY expose richer lineage metadata
- **AND** the response SHALL still respect role scope, privacy minimization, and export boundaries.
