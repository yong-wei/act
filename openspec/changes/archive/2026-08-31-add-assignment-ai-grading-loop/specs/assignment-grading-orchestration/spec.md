## ADDED Requirements

### Requirement: Teachers grade published assignment submissions only after the original deadline
The system SHALL permit an authorized assignment teacher to create AI or manual grading only after the original deadline stored for each submission's frozen audience has passed. Student submission and passage of time SHALL NOT independently trigger grading.

#### Scenario: Teacher starts grading before a submission deadline
- **WHEN** an authorized teacher requests AI or manual grading for a submission before that submission's frozen audience original deadline
- **THEN** the system SHALL reject the command without creating a grading operation, batch, run, review, or result release.

#### Scenario: Deadline passes without a teacher command
- **WHEN** an assignment audience reaches its deadline and no teacher command is made
- **THEN** the system SHALL retain submitted answers in a pending state and SHALL NOT call a Provider or create a manual score.

#### Scenario: A revision has audiences with different deadlines
- **WHEN** a teacher starts one-click grading for a revision where one frozen audience deadline has passed and another has not
- **THEN** the system SHALL include only eligible submissions whose own frozen audience deadline has passed
- **AND** it SHALL retain each included submission's audience identity and original deadline in the operation audit record.

### Requirement: One-click AI grading freezes an eligible submission-attempt range
The system SHALL let an authorized teacher start an idempotent assignment-level AI grading operation after each included submission's deadline. The operation SHALL freeze each included student's immutable assignment submission snapshot, including the complete ordered question-attempt vector, before creating question-scoped grading work.

#### Scenario: Teacher starts the default range
- **WHEN** a teacher starts one-click AI grading without exclusions after the deadline
- **THEN** the operation SHALL include each student with at least one valid submitted question attempt that still requires grading
- **AND** it SHALL exclude students with no submitted attempts and students whose current result is already fully teacher-approved and explicitly released.

#### Scenario: Snapshot combines prior and resubmitted question attempts
- **WHEN** a student has a later authorized attempt for one question and earlier current attempts for other questions
- **THEN** the system SHALL create a new immutable assignment submission snapshot containing the ordered current attempt identity or explicit missing state for every frozen question
- **AND** the snapshot's stable attempt-vector hash SHALL be referenced by subsequent grading, confirmation, and release audits.

#### Scenario: Teacher excludes a student
- **WHEN** a teacher supplies an authorized student exclusion before operation creation
- **THEN** the operation SHALL not create a grading item for that student's submission attempts.

#### Scenario: Teacher repeats an equivalent command
- **WHEN** the same teacher repeats an equivalent active or completed operation request with the same idempotency key and frozen range
- **THEN** the system SHALL return the existing operation
- **AND** it SHALL NOT create duplicate batches, items, or grading runs.

### Requirement: Assignment operations reuse question-scoped grading with failure isolation
The system SHALL create or reuse existing question-scoped batch, item, conversion, and AI grading-run workflows for every frozen submitted attempt in an assignment grading operation. Each question result SHALL remain independently observable.

#### Scenario: One question fails
- **WHEN** one conversion or AI evaluator call fails for a student's included question
- **THEN** the system SHALL retain that question's failure state and reason
- **AND** it SHALL continue eligible work for the student's other questions and other students.

#### Scenario: Teacher retries a failed question
- **WHEN** an authorized teacher explicitly retries a failed question grading item after the deadline
- **THEN** the system SHALL create a new run identity or reuse an idempotent retry command as appropriate
- **AND** it SHALL preserve prior failed runs and reasons.

### Requirement: AI and manual grading use distinguishable durable sources
Every current or historical question score used by assignment aggregation SHALL have source `AI` or `MANUAL`. A manual score SHALL identify its teacher author and SHALL not contain a Provider request, Provider response, or fabricated AI result.

#### Scenario: Teacher completes a question manually
- **WHEN** an authorized teacher submits a valid manual score and comment for a sealed question attempt after the deadline
- **THEN** the system SHALL persist a `MANUAL` grading record bound to that attempt and the frozen question/rubric
- **AND** the record SHALL be eligible for the same aggregation, confirmation, and release workflow as AI grading.

#### Scenario: Teacher takes over a failed AI question
- **WHEN** a failed AI grading item is manually scored
- **THEN** the manual record SHALL become the current eligible result for that question
- **AND** the failed AI attempt SHALL remain in history.

#### Scenario: Later AI work reaches an already confirmed question
- **WHEN** a later AI batch produces a result for a question that belongs to a confirmed assignment result version
- **THEN** the system SHALL retain the later result as history
- **AND** it SHALL NOT replace the confirmed current score or comment.

### Requirement: External AI grading remains de-identified and failure-closed
Before any assignment AI grading Provider call, the system SHALL enforce the existing external-processing approval and de-identification gate using only the frozen question, rubric, reference answer, minimized submitted evidence, and a pseudonymous sample identity.

#### Scenario: External-processing confirmation is missing
- **WHEN** the required external-processing policy or de-identification confirmation is absent, stale, or disallows the request
- **THEN** the affected grading item SHALL become blocked or failed with an auditable reason
- **AND** the system SHALL NOT send student content to the Provider.

#### Scenario: Provider payload is created
- **WHEN** an approved assignment grading call is prepared
- **THEN** its payload and safe audit projection SHALL exclude student name, student number, class identity, local file path, signed object URL, and raw answer-record comparison data.
