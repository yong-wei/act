## ADDED Requirements

### Requirement: Adaptive assessment attempts are durable
The system SHALL persist adaptive assessment sessions and answers instead of relying on process memory.

#### Scenario: Student submits an adaptive answer
- **WHEN** a student submits an adaptive assessment answer
- **THEN** the system SHALL persist the session id, question reference, answer record, score or correctness, response time, algorithm version, and timestamp
- **AND** the submission SHALL remain readable after application restart.

#### Scenario: Student retries the same adaptive answer submission
- **WHEN** a durable adaptive answer submission is retried for the same session and question
- **THEN** the system SHALL return the existing durable answer reference
- **AND** it SHALL NOT create duplicate answers, ability estimates, mastery updates, or LearningFacts for the same user action.

#### Scenario: Student submits answers concurrently
- **WHEN** multiple durable adaptive answer submissions for the same student arrive concurrently
- **THEN** the system SHALL serialize the student's ability and mastery write path before reading historical answers
- **AND** ability estimates and mastery updates SHALL be computed from a consistent submitted-answer order.

#### Scenario: Student requests the next adaptive question before submitting
- **WHEN** a student requests the next adaptive question for a durable assessment session
- **THEN** the system SHALL persist the selected question id as session-level asked state
- **AND** a later next-question request for the same session SHALL account for both answered questions and previously selected unanswered questions.

#### Scenario: Concurrent next-question requests update asked state
- **WHEN** multiple next-question requests race for the same durable assessment session
- **THEN** the system SHALL detect stale asked-state writes and retry selection from the latest persisted asked set
- **AND** it SHALL NOT return the same question while unasked candidates remain available.

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

#### Scenario: Authenticated student writes or reads persisted assessment data
- **WHEN** an assessment API persists answers, durable next-question state, diagnostic data, or ability reports
- **THEN** the system SHALL derive the target student from the authenticated server session instead of a client-supplied user id
- **AND** unauthenticated requests SHALL be rejected before any durable assessment write or cross-user report read.

#### Scenario: Student requests another user's ability report
- **WHEN** an authenticated student requests an ability report for a different user id
- **THEN** the system SHALL reject the request unless the actor has an explicit administrative authorization path.
