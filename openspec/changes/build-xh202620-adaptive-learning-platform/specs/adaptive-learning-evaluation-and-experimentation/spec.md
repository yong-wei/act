## ADDED Requirements

### Requirement: Adaptive-learning outcomes are measurable
The system SHALL capture evaluation metrics for learner state, path planning, visualization, and Konling interventions.

#### Scenario: Path outcome metrics are recorded
- **WHEN** a student receives or executes an adaptive learning path
- **THEN** the system SHALL record path adoption, node completion, deviation, correction success, explanation clicks, low-confidence path state, and completion windows
- **AND** the recorded events SHALL include path id, node id, ResourceNode id, learner-state version, evidence confidence, and timestamp.

#### Scenario: Intervention metrics are recorded
- **WHEN** Konling presents an intervention
- **THEN** the system SHALL record intervention type, trigger reason, evidence confidence, acceptance or dismissal, helpfulness feedback, and 48-hour follow-through
- **AND** it SHALL support aggregate reporting without exposing raw dialogue text.

#### Scenario: Learner-state quality metrics are recorded
- **WHEN** learner state is generated or refreshed
- **THEN** the system SHALL record freshness, source coverage, explainable-field coverage, missing rate, stale rate, and low-confidence rate.

### Requirement: Experiment assignment is stratified and explainable
The system SHALL support experiment assignment for adaptive-learning variants without corrupting learner evidence.

#### Scenario: Student is assigned to adaptive variant
- **WHEN** an experiment is active
- **THEN** the system SHALL assign eligible students by class, cohort, and initial ability stratum where available
- **AND** it SHALL record variant, assignment time, eligibility reason, and exclusion reason when not assigned.

#### Scenario: Supported variants are distinguishable
- **WHEN** evaluation data is exported or summarized
- **THEN** the system SHALL distinguish current recommendation cards, rules+graph path, rules+graph+bandit, and rules+graph+bandit with Konling intervention variants.

### Requirement: Evaluation reporting protects confidence and privacy
The system SHALL report adaptive-learning metrics with confidence and privacy context.

#### Scenario: Evaluation summary is requested
- **WHEN** a teacher or admin views adaptive-learning evaluation summaries
- **THEN** the response SHALL include metric values, sample counts, confidence or completeness markers, evidence windows, and privacy-safe aggregation level
- **AND** it SHALL not expose raw answer bodies, private dialogue text, hidden Arena evaluation internals, or raw high-frequency traces.
