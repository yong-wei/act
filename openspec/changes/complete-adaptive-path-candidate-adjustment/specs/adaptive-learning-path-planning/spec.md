## ADDED Requirements

### Requirement: Candidate adjustment is grounded in one persisted source candidate
The adaptive learning path planner SHALL derive an adjustment from one authorized persisted source candidate plus normalized request parameters and current governed learner facts, and SHALL NOT infer the source from display order, title, or generated conversation text.

#### Scenario: Source candidate and request are valid
- **WHEN** an adjustment request identifies an authorized persisted source candidate and provides supported structured or mapped intent parameters
- **THEN** the planner SHALL preserve mandatory prerequisites, readiness, teacher policy, privacy, terminal validation, evidence policy, and safety constraints
- **AND** it SHALL generate adjusted alternatives relative to that source candidate.

#### Scenario: Source facts are unavailable
- **WHEN** the source candidate cannot be resolved or its required governed facts are incomplete
- **THEN** the planner SHALL return an unavailable result
- **AND** it SHALL NOT reconstruct the source from client ordering or assistant prose.

### Requirement: Candidate adjustment requires a material path difference
The adaptive learning path planner SHALL distinguish adjusted candidates using governed node identities and ordering or supported path metrics, and SHALL NOT treat explanation text, display labels, or score-only changes as a new route.

#### Scenario: Adjustment changes governed path facts
- **WHEN** a feasible adjusted candidate changes a non-mandatory node, node order, resource composition, checkpoint structure, or supported path constraint relative to the source
- **THEN** the planner SHALL expose the changed facts for server-side difference validation.

#### Scenario: Constraints permit no material alternative
- **WHEN** higher-priority constraints and governed resources cannot produce a materially different executable candidate
- **THEN** the planner SHALL return a structured no-material-difference limitation
- **AND** it SHALL NOT fabricate a cosmetic alternative.
