## ADDED Requirements

### Requirement: Path planner generates constrained explainable paths
The system SHALL generate adaptive learning paths from learner state, the ResourceNode graph, teacher policy, and planning constraints.

#### Scenario: Planner creates a feasible path
- **WHEN** a student requests a learning path with a time budget and learning goal
- **THEN** the planner SHALL infer deficits, filter ResourceNodes, apply prerequisites, availability, teacher policy, privacy, device, risk-intervention, and time constraints
- **AND** it SHALL return a feasible plan DAG with current node, next nodes, alternatives, estimates, and explanations.

#### Scenario: Planner exposes fallback state
- **WHEN** learner evidence or resource mapping is insufficient for a confident path
- **THEN** the planner SHALL return a low-confidence or fallback path state
- **AND** it SHALL explain which evidence or mapping gaps limit personalization.

### Requirement: Objective function is multi-objective
The system SHALL score candidate paths with a multi-objective function rather than optimizing only for speed or score.

#### Scenario: Candidate path is scored
- **WHEN** the planner compares candidate paths
- **THEN** it SHALL consider expected learning gain, engagement, constraint satisfaction, diversity, fatigue, and dropout risk
- **AND** it SHALL expose reason metadata for the selected path and rejected alternatives.

### Requirement: Contextual bandit is limited to local reranking
The system SHALL allow contextual bandit only as a Stage 2 local reranking mechanism after deterministic feasibility checks have produced valid candidates.

#### Scenario: Stage 1 planner runs without bandit
- **WHEN** Stage 1 MVP path planning is active
- **THEN** the planner SHALL generate paths with rules plus graph search and deterministic explanation metadata
- **AND** contextual bandit SHALL NOT be required for a feasible path or path visualization.

#### Scenario: Bandit reranks alternatives
- **WHEN** Stage 2 bandit reranking is enabled and multiple feasible next ResourceNodes satisfy the same path role
- **THEN** contextual bandit MAY rerank those alternatives using learner context and feedback history
- **AND** it SHALL NOT bypass prerequisite, privacy, availability, teacher, or time constraints.

#### Scenario: Reinforcement learning is not production planner
- **WHEN** production path generation runs
- **THEN** reinforcement learning and long-horizon hybrid policies SHALL NOT be required
- **AND** any RL experiment SHALL be isolated from the production planner by feature flag and evaluation policy.

### Requirement: Learning path visualization is available
The system SHALL expose path visualization data for map, timeline, and evidence views.

#### Scenario: Map view data is requested
- **WHEN** a student or authorized teacher opens the path map
- **THEN** the response SHALL include main path, branch paths, current node, completed nodes, risk nodes, blocked nodes, and alternatives.

#### Scenario: Timeline view data is requested
- **WHEN** a student or authorized teacher opens the path timeline
- **THEN** the response SHALL include planned work for 3-day, 7-day, and 14-day windows where applicable
- **AND** it SHALL show estimated time, due policy, status, and deviation markers.

#### Scenario: Evidence view data is requested
- **WHEN** a user inspects why a node was recommended
- **THEN** the response SHALL include evidence basis, confidence, source coverage, learner-state deficits, prerequisite reasons, teacher policy, and alternative nodes.

### Requirement: Path execution feedback is captured
The system SHALL capture path adoption, completion, deviation, correction, explanation clicks, and helpfulness feedback for evaluation and local reranking.

#### Scenario: Student deviates from path
- **WHEN** a student skips, replaces, or abandons a path node
- **THEN** the system SHALL record the deviation with context
- **AND** the planner SHALL be able to generate a correction path without losing the prior evidence chain.
