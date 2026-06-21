# learning-goal-packages Specification

## Purpose
TBD - created by archiving change extend-learning-goals-with-kaq-graph-binding. Update Purpose after archive.
## Requirements
### Requirement: LearningGoal packages bind K/A/Q objectives to student-facing goals
The system SHALL define LearningGoal packages as governed student-facing goal bundles that bind K/A/Q objectives to path planning inputs.

#### Scenario: Path-ready LearningGoal package is loaded
- **WHEN** the LearningGoal package catalog is loaded
- **THEN** each `path-ready` package SHALL expose stable id, title, student-facing description, intent type, knowledge objective ids, capability objective ids, quality objective ids, target graph node ids, resource mix, evidence policy, terminal validation policy, path policy family, status, and version metadata
- **AND** each `path-ready` package SHALL bind at least one knowledge objective, at least one capability objective, and at least one quality objective.

#### Scenario: Higher-order LearningGoal package is loaded
- **WHEN** a LearningGoal package targets design, simulation validation, transfer, or reflective improvement
- **THEN** it SHALL bind at least one quality objective
- **AND** it SHALL expose an evidence limitation when quality evidence is not yet fully governed.

### Requirement: LearningGoal packages extend existing registered goals
LearningGoal packages SHALL extend the current registered goal and goal slice contracts rather than creating a parallel planning system.

#### Scenario: Existing path goal is upgraded
- **WHEN** `control-correction` or `frequency-response-foundations` is read through the LearningGoal package service
- **THEN** it SHALL remain compatible with existing adaptive path generation
- **AND** it SHALL additionally expose K/A/Q objective bindings, student-facing goal metadata, resource mix, evidence policy, terminal validation policy, and version metadata.

#### Scenario: Unknown goal package is requested
- **WHEN** a caller requests an unknown LearningGoal package id
- **THEN** the system SHALL reject it through the governed registered-goal error path
- **AND** it SHALL not fabricate K/A/Q bindings.

### Requirement: LearningGoal package coverage expands path-ready goals
The system SHALL provide enough path-ready LearningGoal packages to support path diversity beyond fixed demonstration goals.

#### Scenario: Initial LearningGoal package catalog is audited
- **WHEN** the initial automatic-control LearningGoal package catalog is validated
- **THEN** it SHALL include at least eight `path-ready` packages
- **AND** the packages SHALL cover multiple learning intents including concept understanding, modeling, analysis, controller design, simulation validation, and transfer/application.

