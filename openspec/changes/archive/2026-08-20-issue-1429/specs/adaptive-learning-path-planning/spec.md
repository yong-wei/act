## MODIFIED Requirements

### Requirement: Path bundles remain explainable
Displayed path bundles SHALL expose why two current options differ and what measurable trade-offs they make. A comparison SHALL be derived deterministically from two explicitly specified options in the same saved path version, SHALL use a normalized unordered option pair for result identity, and SHALL NOT alter, reorder, regenerate, rank, or recommend either option.

#### Scenario: User compares path options
- **WHEN** a student or authorized teacher explicitly selects two valid options from the same current saved path
- **THEN** the response SHALL identify both options and include ordered common nodes, ordered option-only nodes, shared-node order differences, modality or resource mix, estimated effort, checkpoint and readiness facts, locked nodes, terminal validation differences, trade-offs, and evidence limitations
- **AND** the comparison SHALL retain a candidate batch/path version/pair identity
- **AND** personalized claims SHALL be limited to authorized diagnosis, learner-state, path, or resource evidence.

#### Scenario: Three options are available
- **WHEN** a current candidate batch contains three valid options
- **THEN** the system SHALL support every unordered pair exactly once
- **AND** it SHALL not select a pair implicitly or compare an option with itself.

#### Scenario: Compared options have no material difference
- **WHEN** the two explicitly specified options have the same ordered nodes and no material metric difference
- **THEN** the response SHALL state that no material difference is present
- **AND** it SHALL retain the compared option identities so the result remains auditable.

#### Scenario: Stored option facts are insufficient
- **WHEN** either explicitly selected option lacks the ordered node identities or student-safe node summaries required for a reliable comparison
- **THEN** the response SHALL state that a reliable difference explanation is unavailable and identify the comparison limitation
- **AND** it SHALL NOT replace the missing facts with generic, ranked, or model-inferred claims.
