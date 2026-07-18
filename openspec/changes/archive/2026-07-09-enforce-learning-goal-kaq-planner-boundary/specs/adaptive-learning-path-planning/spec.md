## ADDED Requirements

### Requirement: Planner enforces LearningGoal K/A/Q objective boundaries
Graph-driven adaptive path generation SHALL treat LearningGoal K/A/Q objectives and graph targets as the canonical resource boundary.

#### Scenario: LearningGoal boundary is available
- **WHEN** a path-ready LearningGoal is supplied to the planner
- **THEN** candidate ResourceNodes SHALL be admitted only when reviewed metadata matches the LearningGoal knowledge objective, capability objective, quality objective, target graph node, expanded prerequisite subgraph, or policy-required checkpoint/remediation role
- **AND** legacy `knowledgeTargets` or `competencyTargets` SHALL NOT admit an otherwise unrelated resource by themselves.

#### Scenario: Candidate is rejected for objective mismatch
- **WHEN** a high-scoring ResourceNode lacks reviewed K/A/Q, graph, or LearningGoal fit for the requested LearningGoal
- **THEN** the planner SHALL exclude it from executable path options
- **AND** diagnostics SHALL record an objective-boundary mismatch without exposing private learner data.

#### Scenario: Objective coverage is insufficient
- **WHEN** reviewed resources are insufficient after applying LearningGoal K/A/Q boundaries
- **THEN** the planner SHALL return an explicit low-resource limitation
- **AND** it SHALL NOT show cosmetic path variants built from unrelated resources.
