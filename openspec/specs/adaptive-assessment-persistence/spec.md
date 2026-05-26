## Purpose

Define durable adaptive assessment attempt storage and governed evidence materialization for assessment submissions.
## Requirements
### Requirement: Adaptive assessment attempts are durable
The system SHALL persist adaptive assessment sessions and answers instead of relying on process memory.

#### Scenario: Student submits an adaptive answer
- **WHEN** a student submits an adaptive assessment answer
- **THEN** the system SHALL persist the session id, question reference, answer record, score or correctness, response time, algorithm version, and timestamp
- **AND** the submission SHALL remain readable after application restart.

#### Scenario: Student requests the next adaptive question before submitting
- **WHEN** a student requests the next adaptive question for a durable assessment session
- **THEN** the system SHALL persist the selected question id as session-level asked state
- **AND** a later next-question request for the same session SHALL account for both answered questions and previously selected unanswered questions.

#### Scenario: Generated question history is restored
- **WHEN** persisted adaptive answers are restored for diagnostics or ability reporting
- **THEN** the system SHALL restore question difficulty, knowledge tags, question type, and domains from the durable item reference
- **AND** generated or changed questions SHALL still contribute to computational, cross-domain, and design dimensions without relying on in-memory question state.

#### Scenario: Question metadata changes after historical answers exist
- **WHEN** the same question id is answered after its assessment metadata changes under the same algorithm family
- **THEN** the system SHALL create or reuse an immutable item reference keyed by the question id, algorithm version, and metadata content hash
- **AND** it SHALL NOT overwrite the item reference used by older answers.

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
