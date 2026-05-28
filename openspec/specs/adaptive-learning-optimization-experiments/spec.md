## Purpose

Define the Stage 2 adaptive-learning optimization contract for local contextual bandit reranking, stratified experiment assignment, privacy-safe optimization reporting, gated long-term Konling memory, and expanded teacher ResourceNode operations.
## Requirements
### Requirement: Contextual bandit is limited to local reranking
The system SHALL allow contextual bandit only as a Stage 2 local reranking mechanism after deterministic feasibility checks have produced valid candidates.

#### Scenario: Bandit reranks alternatives
- **WHEN** Stage 2 bandit reranking is enabled and multiple feasible next ResourceNodes satisfy the same path role
- **THEN** contextual bandit MAY rerank those alternatives using learner context and feedback history
- **AND** it SHALL NOT bypass prerequisite, privacy, availability, teacher, device, or time constraints.

### Requirement: Experiment assignment is stratified and explainable
The system SHALL support experiment assignment for adaptive-learning variants without corrupting learner evidence.

#### Scenario: Student is assigned to adaptive variant
- **WHEN** an experiment is active
- **THEN** the system SHALL assign eligible students by class, cohort, and initial ability stratum where available
- **AND** it SHALL record variant, assignment time, eligibility reason, and exclusion reason when not assigned.

#### Scenario: Supported variants are reported
- **WHEN** evaluation data is exported or summarized
- **THEN** the system SHALL distinguish current recommendation cards, rules+graph path, rules+graph+bandit, and rules+graph+bandit with Konling intervention variants.

### Requirement: Optimization metrics are privacy-safe
The system SHALL report adaptive-learning optimization metrics with confidence and privacy context.

#### Scenario: Evaluation summary is requested
- **WHEN** a teacher or admin views adaptive-learning evaluation summaries
- **THEN** the response SHALL include metric values, sample counts, confidence or completeness markers, evidence windows, and privacy-safe aggregation level
- **AND** it SHALL not expose raw answer bodies, private dialogue text, hidden Arena evaluation internals, or raw high-frequency traces.

### Requirement: Long-term memory is gated
The system SHALL enable semantic learner memory and strategy memory only after Stage 1 outcomes are stable and privacy-audited.

#### Scenario: Strategy memory is enabled
- **WHEN** long-term strategy memory is enabled
- **THEN** the system SHALL verify privacy audit coverage, persisted intervention outcomes, and evaluation metrics exist
- **AND** it SHALL provide feature-flag rollback to the Stage 1 memory model.

