## MODIFIED Requirements

### Requirement: Learner-state consumers use portrait v2
Learner-state consumers SHALL treat portrait v2 as the primary learner portrait for student-facing and personalization-facing behavior. When the current cumulative portrait is `NO_EVIDENCE`, consumers SHALL fail closed and SHALL NOT fall back to a legacy snapshot, feature cache, old `StudentCompetencySnapshot`, or old competency vector.

#### Scenario: AI Workshop consumes learner state
- **WHEN** the AI Workshop reads learner state
- **THEN** it SHALL use the server-owned response and its explicit portrait/evidence state
- **AND** it SHALL render `NO_EVIDENCE` or `UNAVAILABLE` as a limitation rather than deriving a legacy or sample profile.

### Requirement: Learner portrait exposes task-normalized simulation attainment
The learner-state service SHALL expose task-normalized simulation attainment only when eligible governed simulation task evidence exists.

#### Scenario: AI Workshop has no eligible simulation evidence
- **WHEN** no eligible simulation task contribution exists
- **THEN** the AI Workshop SHALL show no verified simulation record
- **AND** it SHALL not substitute a hard-coded experiment count, score, duration, or unlocked state.
