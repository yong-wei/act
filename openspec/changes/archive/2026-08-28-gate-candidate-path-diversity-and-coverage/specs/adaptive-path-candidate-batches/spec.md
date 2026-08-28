## ADDED Requirements

### Requirement: Candidate batches keep only material path differences

Persisted adaptive-path candidate batches SHALL include only executable candidates whose material facts differ. Material facts are node identity and order, personalizable resource mix, estimated effort, checkpoints, and terminal validation. Title, description, explanation, score, and client display order SHALL NOT create a new candidate. Shared required prerequisite or terminal-validation nodes MAY be identical.

#### Scenario: Title-only duplicates are rejected

- **WHEN** two generated options differ only in label, description, or score
- **THEN** the batch SHALL persist one candidate
- **AND** it SHALL record a diversity limitation explaining the reduction

#### Scenario: Shared required nodes remain distinct options

- **WHEN** two options share terminal-validation nodes but differ in remaining node identity, order, resource mix, or effort
- **THEN** both candidates SHALL remain in the batch

#### Scenario: Resource coverage is insufficient

- **WHEN** material facts cannot support two distinct executable options
- **THEN** the batch SHALL persist the real candidate count
- **AND** it SHALL expose a student-understandable limitation instead of fabricating another card
