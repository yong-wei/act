## MODIFIED Requirements

### Requirement: Planner supports registered learning goals
The adaptive path planner SHALL generate learning paths for registered LearningGoals rather than for nested LearningGoal packages or fixed demonstration goals.

#### Scenario: Registered LearningGoal is requested
- **WHEN** a student requests a path for a `path-ready` LearningGoal
- **THEN** the planner SHALL load the LearningGoal's K/A/Q objective bindings, allowed resource mix, evidence policy, checkpoint policy, terminal validation policy, and explanation templates
- **AND** it SHALL return executable path options with current node, alternatives, estimated time, evidence limits, and student-facing rationale.

#### Scenario: Legacy registered goal is requested
- **WHEN** a caller requests an existing registered goal id that is now represented as a LearningGoal
- **THEN** the planner SHALL preserve existing compatible output fields
- **AND** it SHALL include canonical LearningGoal metadata for downstream graph expansion when available.

#### Scenario: Client supplies nested package metadata
- **WHEN** a client request includes nested `learningGoalPackage` metadata under the requested goal
- **THEN** the planner SHALL ignore client-supplied nested package fields and resolve the server-owned LearningGoal by id
- **AND** forged objective ids, graph node ids, resource policies, or evidence policies SHALL NOT override the registered LearningGoal.
