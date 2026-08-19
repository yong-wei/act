## ADDED Requirements

### Requirement: Prompt assessment attempts are learner-owned durable process evidence
The system SHALL persist each production prompt-quality evaluation in `PromptAssessment` under the authenticated student's identity, evaluation session, and monotonically assigned version. A record SHALL retain the evaluated prompt, structured prompt data, quality result, bounded task-context metadata, and creation time for traceability.

#### Scenario: Authenticated student evaluates a prompt
- **WHEN** an authenticated student submits a valid prompt-quality evaluation
- **THEN** the system SHALL create exactly one `PromptAssessment` record owned by that student
- **AND** the returned quality result SHALL correspond to the persisted record

#### Scenario: Evaluator behavior changes after an assessment is stored
- **WHEN** a later deployment changes intent detection, completeness analysis, or improvement-potential logic
- **THEN** reading an existing prompt assessment version SHALL return its quality-result snapshot written at evaluation time
- **AND** it SHALL NOT recompute that historical result with the later evaluator

#### Scenario: Client supplies another user identity
- **WHEN** an authenticated student submits a prompt-quality evaluation containing a different `userId`
- **THEN** the system SHALL persist the record for the authenticated student only
- **AND** it SHALL NOT read or write any record for the supplied identity

#### Scenario: Unauthenticated caller evaluates a prompt
- **WHEN** a caller without an authenticated student session requests prompt-quality evaluation
- **THEN** the system SHALL reject the request before evaluating or persisting learning data

### Requirement: Prompt evaluation versions remain unique under retry
The system SHALL maintain a unique `(userId, sessionId, version)` identity for prompt assessments and SHALL allocate the next version at the persistence boundary.

#### Scenario: Concurrent submissions share one evaluation session
- **WHEN** two requests for the same authenticated student and evaluation session allocate their next prompt version concurrently
- **THEN** each successfully persisted record SHALL have a distinct version
- **AND** the system SHALL not create duplicate learner/session/version records

#### Scenario: Evaluation service restarts
- **WHEN** an authenticated student reads prompt history after an application restart or from another application instance
- **THEN** the system SHALL read the student's persisted `PromptAssessment` records from the database
- **AND** it SHALL NOT depend on process-local history state

### Requirement: Consistency results attach only to owned prompt assessment attempts
The system SHALL persist a process-consistency result only by updating the authenticated student's matching prompt assessment session and version.

#### Scenario: Student checks consistency for an owned attempt
- **WHEN** an authenticated student submits consistency input for an existing owned prompt assessment version
- **THEN** the system SHALL calculate and attach the consistency result to that same persisted attempt
- **AND** it SHALL return the attached result without creating an unrelated assessment record

#### Scenario: Consistency target is absent or foreign
- **WHEN** a caller references a prompt assessment version that is absent or belongs to another student
- **THEN** the system SHALL reject the request without reading or updating the foreign attempt

#### Scenario: Unauthenticated caller checks consistency
- **WHEN** a caller without an authenticated student session requests process-consistency evaluation
- **THEN** the system SHALL reject the request before reading or updating assessment data

### Requirement: Prompt assessment history is user-scoped and context-only
The system SHALL return prompt assessment history only to its authenticated owner. Prompt assessment and consistency records SHALL remain learning-process context and SHALL NOT directly create `LearningFact`, learner-portrait, official-score, leaderboard, or recommendation updates.

#### Scenario: Student requests own history
- **WHEN** an authenticated student requests prompt history using their own route identity
- **THEN** the system SHALL return only that student's persisted assessment projection in stable chronological and version order

#### Scenario: Student requests another student's history
- **WHEN** an authenticated student requests prompt history using another student's route identity
- **THEN** the system SHALL reject the request before querying that student's assessment records

#### Scenario: Assessment is persisted
- **WHEN** the system persists a prompt-quality evaluation or a consistency result
- **THEN** it SHALL NOT invoke a `LearningFact` writer, learner-portrait updater, official-score writer, leaderboard writer, or recommendation updater

#### Scenario: Client-only demonstration mode runs
- **WHEN** the prompt-assessment page is in its existing demonstration mode
- **THEN** it SHALL continue to generate local demonstration records without invoking unauthenticated production evaluation routes
