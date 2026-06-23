## MODIFIED Requirements

### Requirement: Path planner generates constrained explainable paths
The system SHALL generate adaptive learning paths from learner state, the ResourceNode graph, registered LearningGoal strategy, teacher policy, planning constraints, ranked resource candidates, and bounded repair output where available.

#### Scenario: Planner repairs a graph-driven draft path
- **WHEN** graph search produces a draft path with bounded alternatives
- **THEN** the planner MAY invoke path constraint repair to satisfy prerequisites, time budget, checkpoint policy, terminal validation policy, readiness, and serial/parallel constraints
- **AND** repaired paths and infeasible fallback states SHALL expose explanation metadata rather than hiding constraint failures.

### Requirement: Stage 1 planner excludes contextual bandit and RL
The system SHALL generate Stage 1 MVP paths without contextual bandit, reinforcement learning, or long-horizon hybrid policies.

#### Scenario: Repair runs in Stage 1
- **WHEN** path constraint repair is enabled
- **THEN** it SHALL remain a deterministic or solver-bounded feasibility step after candidate filtering and ranking
- **AND** it SHALL NOT introduce contextual bandit, reinforcement learning, or black-box long-horizon policy selection.
