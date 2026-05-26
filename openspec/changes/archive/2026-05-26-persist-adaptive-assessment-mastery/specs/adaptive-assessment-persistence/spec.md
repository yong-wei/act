## ADDED Requirements

### Requirement: Adaptive assessment attempts are durable
The system SHALL persist adaptive assessment sessions and answers instead of relying on process memory.

#### Scenario: Student submits an adaptive answer
- **WHEN** a student submits an adaptive assessment answer
- **THEN** the system SHALL persist the session id, question reference, answer record, score or correctness, response time, algorithm version, and timestamp
- **AND** the submission SHALL remain readable after application restart.

### Requirement: Assessment evidence enters governed facts
The system SHALL materialize adaptive assessment outcomes into governed learning evidence.

#### Scenario: Assessment submission is finalized
- **WHEN** an adaptive assessment submission produces a score or mastery update
- **THEN** the system SHALL create or enqueue a governed LearningFact with safe source references, knowledge tags, derived score, ability estimate, confidence, and privacy level
- **AND** it SHALL NOT copy raw answer bodies or full question text into normal learner-state payloads.

### Requirement: Assessment API remains compatible
The system SHALL preserve existing assessment response compatibility during persistence migration.

#### Scenario: Existing caller submits an answer
- **WHEN** an existing assessment client calls the submission API
- **THEN** the response shape SHALL remain compatible with the previous caller contract
- **AND** new durable identifiers MAY be added as optional fields.
