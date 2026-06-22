## MODIFIED Requirements

### Requirement: Planner supports registered learning goals
The adaptive path planner SHALL generate learning paths for registered LearningGoals with graph-driven context.

#### Scenario: Graph-driven LearningGoal is requested
- **WHEN** a student requests a path for a `path-ready` LearningGoal with an ExpandedGoalSubgraph
- **THEN** the planner SHALL consume the LearningGoal id, LearningGoal version, K/A/Q objective boundary, K/A/Q graph targets, prerequisite policy, allowed resource mix, evidence policy, checkpoint policy, terminal validation policy, and version refs
- **AND** it SHALL return executable path options with current node, alternatives, estimated time, evidence limits, graph/resource limitations, and student-facing rationale.

### Requirement: Generated paths use governed resource nodes
Adaptive path generation SHALL use only audited resource nodes and checkpoint nodes with registered path semantics.

#### Scenario: ResourceNode graph profile is used
- **WHEN** the planner considers a ResourceNode for a graph-driven path
- **THEN** it SHALL use ResourceNode graph profile metadata including graph refs, scene availability, citation readiness, evidence capability, path profile, readiness, and governance limitations
- **AND** it SHALL NOT use ResourceSegment, RetrievalChunk, or CitationTarget as a PathNode unless an audited ResourceNode or checkpoint contract authorizes it.

### Requirement: Cold-start learners receive executable starter paths
The planner SHALL treat cold start as a supported generation state, not as a no-path failure.

#### Scenario: Cold-start learner requests a graph-driven path
- **WHEN** a learner with no usable evidence requests a graph-driven LearningGoal path
- **THEN** the planner SHALL use the LearningGoal policy, resource coverage, ResourceNode readiness, and graph prerequisites to return executable starter options where resources are available
- **AND** low evidence SHALL be exposed as a limitation rather than clearing the path.

### Requirement: Generic path rounds are persisted
The system SHALL persist learning path rounds across registered goals.

#### Scenario: Graph-driven path round is persisted
- **WHEN** a generated graph-driven path option is created or selected
- **THEN** the persisted path SHALL include owner user, goal id, goal version, graph version, resource registry or projection version, overlay version where used, planner version, status, selected option, current node, path payload, explanation payload, alternative payload, and evidence window references
- **AND** it SHALL be resumable without recomputing the original graph/resource basis.

### Requirement: Planner accepts Konling path-generation requests
The adaptive path planner SHALL accept governed Konling tool requests as one path generation input channel.

#### Scenario: Konling invokes graph-driven planner
- **WHEN** a governed Konling path tool calls the planner with graph-driven context
- **THEN** the planner SHALL consume only server-owned LearningGoal, graph, learner, class, resource, path, and privacy context
- **AND** client text SHALL NOT expand accessible resources, evidence, graph nodes, or permissions.
