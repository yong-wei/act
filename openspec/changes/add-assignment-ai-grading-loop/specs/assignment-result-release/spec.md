## ADDED Requirements

### Requirement: Assignment results aggregate question outcomes without silent zero scores
The system SHALL maintain a current assignment-level result for each immutable assignment submission snapshot by aggregating its frozen questions, ordered question-attempt vector, current eligible question results, teacher conclusions, and total score. A missing question SHALL NOT receive an automatic zero.

#### Scenario: Student submitted only some questions
- **WHEN** an included student has valid attempts for only some assignment questions
- **THEN** the aggregate SHALL identify the missing questions as unresolved
- **AND** it SHALL not derive a publishable total by assigning zero points.

#### Scenario: Teacher records a non-score conclusion
- **WHEN** an authorized teacher records an allowed `UNANSWERED` or `EXEMPT` conclusion for a question
- **THEN** the aggregate SHALL retain the conclusion and its author/audit data
- **AND** it SHALL use that explicit conclusion for completeness and total calculation.

### Requirement: Teachers confirm complete assignment results before release
The system SHALL allow an authorized teacher to confirm one student's assignment result only when every frozen question in one immutable assignment submission snapshot has a current AI score, manual score, or explicit teacher conclusion. Confirmation SHALL freeze the final score, comments, source selections, question snapshots, reference answers, rubric snapshots, and attempt-vector hash for that result version.

#### Scenario: Result has a failed or unresolved question
- **WHEN** the teacher attempts confirmation while any frozen question is failed, missing, or otherwise unresolved
- **THEN** the system SHALL reject confirmation and identify the unresolved question state
- **AND** it SHALL not create a releaseable confirmation snapshot.

#### Scenario: Teacher confirms a complete result
- **WHEN** every frozen question has an eligible result or explicit conclusion and the teacher confirms the submission
- **THEN** the system SHALL create or return one immutable confirmation snapshot with teacher identity, time, aggregate version, and frozen content hashes
- **AND** later AI work SHALL not alter that snapshot.

### Requirement: Teachers release confirmed student results individually as an inseparable package
The system SHALL allow an authorized teacher to release one confirmed assignment result without waiting for other students. A release SHALL atomically bind the final total, question scores, teacher-confirmed comments, reference answers, and scoring standards in one student-visible package.

#### Scenario: Teacher releases one confirmed student
- **WHEN** a teacher releases a complete confirmed assignment result for one student
- **THEN** the system SHALL create or return one immutable release record and student projection for that confirmation version
- **AND** it SHALL not require another student's result to be complete, confirmed, or released.

#### Scenario: Teacher tries to release an unconfirmed result
- **WHEN** a teacher requests release for a result without a complete confirmation snapshot
- **THEN** the system SHALL reject the request without disclosing any score, comment, answer, or scoring standard.

#### Scenario: Teacher repeats a release command
- **WHEN** a teacher repeats the same release command with its idempotency key
- **THEN** the system SHALL return the original release record
- **AND** it SHALL not create a second visible package.

### Requirement: Students see only their own released assignment-result package
Student assignment responses SHALL return final scores, question feedback, reference answers, and scoring standards only from the requesting student's released result package. Internal AI drafts, Provider failures, raw AI scores, and teacher edit history SHALL remain unavailable to students.

#### Scenario: Student opens an unreleased assignment result
- **WHEN** a student opens an assignment whose current result is pending, grading, failed, unconfirmed, or unreleased
- **THEN** the response SHALL not include final score, question feedback, reference answer, scoring standard, AI draft, or internal failure detail.

#### Scenario: Student opens a released result
- **WHEN** the owning student opens an assignment with a released current result package
- **THEN** the response SHALL include that package's final score, question scores, teacher-confirmed comments, reference answers, and scoring standards
- **AND** it SHALL not include AI raw values, Provider metadata, or teacher edit history.

#### Scenario: Another student requests a release
- **WHEN** a student requests another student's assignment result or attempts to guess a release identity
- **THEN** the system SHALL reject access without returning package content or grading metadata.

### Requirement: Post-deadline resubmissions create new grading candidates without overwriting history
The system SHALL permit a resubmission only when an authorized teacher returns the relevant work after that submission's frozen audience original deadline and grants a new deadline. The resulting attempt SHALL create a later immutable assignment submission snapshot, enter a later grading operation, and SHALL not overwrite prior grading, confirmation, or release history.

#### Scenario: Teacher grants a post-deadline resubmission
- **WHEN** the original assignment deadline has passed and an authorized teacher returns a question with a new deadline
- **THEN** the system SHALL create an auditable resubmission grant and accept a new question attempt only within that grant.

#### Scenario: Resubmission is received after an earlier batch
- **WHEN** a student submits a new attempt under a valid resubmission grant after an earlier grading operation was created
- **THEN** the new attempt SHALL remain outside the earlier operation
- **AND** a later operation SHALL treat it as a new pending grading candidate while preserving prior history.
