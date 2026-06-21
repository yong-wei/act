## MODIFIED Requirements

### Requirement: Planner supports registered learning goals
The adaptive path planner SHALL generate learning paths for registered learning goals and LearningGoal packages rather than only for fixed demonstration goals.

#### Scenario: Registered LearningGoal package is requested
- **WHEN** a student requests a path for a `path-ready` LearningGoal package
- **THEN** the planner SHALL load the package's K/A/Q objective bindings, allowed resource mix, evidence policy, checkpoint policy, terminal validation policy, and explanation templates
- **AND** it SHALL return executable path options with current node, alternatives, estimated time, evidence limits, and student-facing rationale.

#### Scenario: Legacy registered goal is requested
- **WHEN** a caller requests an existing registered goal id that has been upgraded to a LearningGoal package
- **THEN** the planner SHALL preserve existing compatible output fields
- **AND** it SHALL include package metadata for downstream graph expansion when available.
