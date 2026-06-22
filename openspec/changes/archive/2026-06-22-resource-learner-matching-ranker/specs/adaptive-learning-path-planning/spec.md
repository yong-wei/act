## MODIFIED Requirements

### Requirement: Objective function is multi-objective
The system SHALL score candidate paths with a multi-objective function rather than optimizing only for speed or score, and it MAY consume ranked ResourceNode candidate sets produced by the governed resource-learner matching layer.

#### Scenario: Candidate resources are scored before path assembly
- **WHEN** the planner compares graph-driven resource candidates for a LearningGoal
- **THEN** it SHALL use ranked candidate explanations or equivalent internal scoring metadata that considers graph coverage, capability contribution, evidence potential, learner fit, accessibility, freshness, time cost, cognitive load, readiness, and constraints
- **AND** it SHALL expose reason metadata for selected and rejected resources or path alternatives.

### Requirement: Generated paths use governed resource nodes
Adaptive path generation SHALL use only audited resource nodes and checkpoint nodes with registered path semantics, even when ranking consumes retrieval or citation projections as semantic signals.

#### Scenario: Ranked retrieval chunk lacks ResourceNode audit
- **WHEN** a RetrievalChunk or CitationTarget ranks highly for graph relevance
- **THEN** the planner SHALL NOT turn it into a PathNode unless an audited ResourceNode or checkpoint contract authorizes it
- **AND** diagnostics SHALL distinguish retrieval relevance from path eligibility.
