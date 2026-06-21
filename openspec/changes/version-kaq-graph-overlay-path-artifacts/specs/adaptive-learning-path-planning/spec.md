## MODIFIED Requirements

### Requirement: Generic path rounds are persisted
The system SHALL persist learning path rounds across registered goals with versioned graph-driven context.

#### Scenario: Graph-driven path round is created
- **WHEN** a generated path option is created or selected from a LearningGoal package
- **THEN** the persisted path SHALL include owner user, goal id, goal version, graph version, resource registry or projection version, planner version, status, selected option, current node, path payload, explanation payload, alternative payload, and evidence window references
- **AND** it SHALL be resumable without recomputing the original graph/resource basis.
