## ADDED Requirements

### Requirement: LearningGoal objectives are planner boundary inputs
LearningGoals SHALL expose K/A/Q objective and graph metadata in a form that the path planner can use as a hard boundary.

#### Scenario: Planner reads a path-ready LearningGoal
- **WHEN** the planner loads a path-ready LearningGoal
- **THEN** it SHALL receive knowledge objective ids, capability objective ids, quality objective ids, target graph node ids, prerequisite graph refs, resource mix policy, checkpoint policy, and terminal validation policy
- **AND** these fields SHALL be sufficient to filter candidate resources without page-local allow-lists.

#### Scenario: LearningGoal metadata is incomplete
- **WHEN** a path-ready LearningGoal lacks boundary metadata required by the planner
- **THEN** catalog validation SHALL fail
- **AND** path generation SHALL report a LearningGoal metadata blocker rather than broadening to legacy compatibility fields.
