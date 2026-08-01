## MODIFIED Requirements

### Requirement: Path bundles remain explainable
Displayed path bundles SHALL expose why two current options differ and what measurable trade-offs they make. A comparison SHALL be derived deterministically from the two specified options in the same saved path version and SHALL NOT alter, reorder or regenerate either option.

#### Scenario: User compares path options
- **WHEN** a student or authorized teacher compares two valid options from the same current saved path
- **THEN** the response SHALL identify both options and include ordered common nodes, ordered option-only nodes, shared-node order differences, modality or resource mix, estimated effort, checkpoint and readiness facts, locked nodes, terminal validation differences, trade-offs, and evidence limitations
- **AND** personalized claims SHALL be limited to authorized diagnosis, learner-state, path, or resource evidence.

#### Scenario: Compared options have no material difference
- **WHEN** the two specified options have the same ordered nodes and no material metric difference
- **THEN** the response SHALL state that no material difference is present
- **AND** it SHALL retain the compared option identities so the result remains auditable.

#### Scenario: Stored option facts are insufficient
- **WHEN** either option lacks the ordered node identities or student-safe node summaries required for a reliable comparison
- **THEN** the response SHALL state that a reliable difference explanation is unavailable and identify the comparison limitation
- **AND** it SHALL NOT replace the missing facts with generic or model-inferred claims.

#### Scenario: Diagnosis and Konling consume path option context
- **WHEN** diagnosis surfaces or the Konling path-advisor read the current control-correction path context
- **THEN** they SHALL receive sanitized path option summaries and selection history
- **AND** the context SHALL expose evidence basis and terminal validation references without private raw traces or hidden prompt payloads.
