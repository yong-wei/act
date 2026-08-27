## ADDED Requirements

### Requirement: The canonical path planner is a single staged pipeline

The adaptive learning path planning capability SHALL be implemented behind one Personalization application pipeline. Candidate discovery, qualification, ranking, constraint repair, assembly and explanation MUST remain separately observable and testable, while the resulting path continues to use the canonical capability contracts.

#### Scenario: Existing path API is migrated

- **WHEN** a learning-path, advisor or candidate-batch API is served after cutover
- **THEN** it SHALL call the canonical pipeline
- **AND** it SHALL preserve its public response compatibility without retaining an old planner authority or re-export.

### Requirement: Planner output cannot elevate a soft recommendation

The path planner SHALL distinguish hard eligibility from soft recommendation. A candidate's ranking, recommendation, explanation, model narrative or browsing history MUST NOT by itself satisfy prerequisite, mastery, readiness, Arena evaluation or permission gates.

#### Scenario: A recommendation is highly ranked

- **WHEN** a recommendation receives a high soft score but lacks independent governed evidence
- **THEN** the candidate SHALL remain subject to the hard eligibility gate
- **AND** no path, mastery or readiness record SHALL be elevated solely by that score.
