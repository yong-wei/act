# learning-goal-packages Specification

## Purpose
TBD - created by archiving change extend-learning-goals-with-kaq-graph-binding. Update Purpose after archive.
## Requirements
### Requirement: LearningGoals bind K/A/Q objectives to student-facing goals
The system SHALL define LearningGoals as governed student-facing goal records that bind K/A/Q objectives to path planning inputs.

#### Scenario: Path-ready LearningGoal is loaded
- **WHEN** the LearningGoal catalog is loaded
- **THEN** each `path-ready` LearningGoal SHALL expose stable id, title, student-facing description, intent type, knowledge objective ids, capability objective ids, quality objective ids, target graph node ids, resource mix, evidence policy, terminal validation policy, path policy family, status, and version metadata
- **AND** each `path-ready` LearningGoal SHALL bind at least one knowledge objective, at least one capability objective, and at least one quality objective.

#### Scenario: Higher-order LearningGoal is loaded
- **WHEN** a LearningGoal targets design, simulation validation, transfer, or reflective improvement
- **THEN** it SHALL bind at least one quality objective
- **AND** it SHALL expose an evidence limitation when quality evidence is not yet fully governed.

### Requirement: LearningGoals are the registered goal truth
LearningGoals SHALL extend the current registered goal and goal slice contracts as first-class student-facing targets rather than as nested packages.

#### Scenario: Existing path goal is represented as a LearningGoal
- **WHEN** `control-correction` or `frequency-response-foundations` is read through the LearningGoal service
- **THEN** it SHALL remain compatible with existing adaptive path generation
- **AND** it SHALL directly expose K/A/Q objective bindings, student-facing goal metadata, resource mix, evidence policy, terminal validation policy, and version metadata.

#### Scenario: Unknown LearningGoal is requested
- **WHEN** a caller requests an unknown LearningGoal id
- **THEN** the system SHALL reject it through the governed registered-goal error path
- **AND** it SHALL not fabricate K/A/Q bindings.

#### Scenario: Legacy package payload is read
- **WHEN** an existing persisted path contains legacy `learningGoalPackage` metadata
- **THEN** the system SHALL normalize it to the canonical LearningGoal shape for read-time explanation
- **AND** new generated path payloads SHALL NOT treat nested package metadata as the canonical goal truth.

### Requirement: LearningGoal coverage expands path-ready goals
The system SHALL provide enough path-ready LearningGoals to support path diversity beyond fixed demonstration goals.

#### Scenario: Initial LearningGoal catalog is audited
- **WHEN** the initial automatic-control LearningGoal catalog is validated
- **THEN** it SHALL include at least eight `path-ready` LearningGoals
- **AND** the LearningGoals SHALL cover multiple learning intents including concept understanding, modeling, analysis, controller design, simulation validation, and transfer/application.

