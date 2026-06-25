## ADDED Requirements

### Requirement: LearningGoals expose path entrypoint metadata
Each `path-ready` LearningGoal SHALL expose enough governed metadata to drive student-facing path generation and Konling path-advisor entrypoints without page-local duplication.

#### Scenario: Path-ready LearningGoal enters the path center catalog
- **WHEN** a LearningGoal is marked `path-ready`
- **THEN** it SHALL expose stable id, title, description, completion meaning, intent type, recommended phase, K/A/Q objective ids, graph node ids, resource mix, evidence policy, terminal validation policy, path policy family, status, and version metadata
- **AND** it SHALL be projectable into a student-facing path generation option and a Konling path-advisor context.

#### Scenario: Metadata is incomplete
- **WHEN** a path-ready LearningGoal is missing student-facing text, objective bindings, graph bindings, resource mix, evidence policy, terminal validation policy, path policy family, or version metadata
- **THEN** LearningGoal catalog validation SHALL fail
- **AND** the LearningGoal SHALL NOT silently disappear from the adaptive path center as a workaround.

#### Scenario: Current first-batch goals are checked
- **WHEN** the first-batch automatic-control LearningGoal catalog is validated
- **THEN** the test suite SHALL assert that the current nine path-ready LearningGoals all have complete entrypoint metadata
- **AND** the assertion SHALL derive the expected count from the registered catalog or an explicit first-batch fixture, not from a two-goal UI allow-list.
