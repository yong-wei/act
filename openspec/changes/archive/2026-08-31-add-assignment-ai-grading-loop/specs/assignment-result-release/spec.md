## ADDED Requirements

### Requirement: Assignment results aggregate question outcomes without silent zero scores
The system SHALL derive the current assignment-level result for each immutable assignment submission snapshot from its frozen questions, ordered question-attempt vector, current question-level teacher approval snapshots, and canonical teacher question exemptions. A missing question SHALL NOT receive an automatic zero.

#### Scenario: Student submitted only some questions
- **WHEN** an included student has valid attempts for only some assignment questions
- **THEN** the derived aggregate SHALL identify the missing questions as unresolved
- **AND** it SHALL not derive a publishable total by assigning zero points.

#### Scenario: Teacher records a non-score conclusion
- **WHEN** an authorized teacher records an allowed `UNANSWERED` or `EXEMPT` conclusion for a question
- **THEN** the system SHALL persist it as a canonical per-submission question exemption with teacher identity and audit data
- **AND** the derived aggregate SHALL use that explicit conclusion for completeness and total calculation.

### Requirement: Teachers confirm complete assignment results before release
The system SHALL allow an authorized teacher to confirm one student's assignment result only when every frozen question in one immutable assignment submission snapshot has a current question-level teacher approval snapshot or an explicit teacher exemption. The question-level teacher approval SHALL remain the only score authority and the immutable confirmation record; the assignment-level confirmation command SHALL re-derive completeness server-side and return a derived confirmation view without persisting a second grading state machine.

#### Scenario: Result has a failed or unresolved question
- **WHEN** the teacher attempts confirmation while any frozen question is failed, missing, or otherwise unresolved
- **THEN** the system SHALL reject confirmation and identify the unresolved question state
- **AND** it SHALL not treat the submission as releaseable.

#### Scenario: Teacher confirms a complete result
- **WHEN** every frozen question has a teacher-approved question result or explicit exemption and the teacher confirms the submission
- **THEN** the system SHALL derive and return the confirmation view with teacher identity, time, total, and per-question projection
- **AND** later AI work SHALL not alter the question-level approval snapshots backing it.

### Requirement: Teachers release confirmed student results individually as an inseparable package
The system SHALL treat assignment-level release as an explicit teacher authorization: for teacher-confirmed-result revisions, question approval SHALL queue publication commands behind an assignment-level gate that prepares derivatives without granting student visibility, and the assignment-level release command SHALL lift the gate, wake the pending publication commands with teacher identity and time recorded as release audit, and mark the submission explicitly reviewed. A release SHALL make the final total, question scores, teacher-confirmed comments, reference answers, and scoring standards visible to the owning student only as one inseparable package.

#### Scenario: Teacher releases one confirmed student
- **WHEN** a teacher releases a complete confirmed assignment result for one student
- **THEN** the system SHALL wake the gated publication commands for that submission and record the explicit release authorization
- **AND** it SHALL not require another student's result to be complete, confirmed, or released.

#### Scenario: Publication succeeds without the teacher release command
- **WHEN** question-level publication commands complete while the assignment-level gate is still in place
- **THEN** the student SHALL NOT see the final total, reference answers, or scoring standards
- **AND** question feedback SHALL remain hidden until the teacher lifts the gate.

#### Scenario: Teacher tries to release an unconfirmed result
- **WHEN** a teacher requests release for a result without complete question-level confirmations
- **THEN** the system SHALL reject the request without disclosing any score, comment, answer, or scoring standard.

#### Scenario: Teacher repeats a release command
- **WHEN** a teacher repeats the assignment-level release command
- **THEN** the system SHALL keep the explicit reviewed state and already-succeeded publications idempotently
- **AND** it SHALL not duplicate student-visible content or drop question-level fallback markers already recorded in the command payloads.

### Requirement: Students see only their own released assignment-result package
Student assignment responses SHALL derive final scores, question feedback, reference answers, and scoring standards only from the requesting student's explicitly released submission: every non-exempt frozen question's publication SHALL have succeeded with a feedback release owned by the student, and the submission SHALL carry the explicit reviewed release state. Internal AI drafts, Provider failures, raw AI scores, and teacher edit history SHALL remain unavailable to students.

#### Scenario: Student opens an unreleased assignment result
- **WHEN** a student opens an assignment whose current result is pending, grading, failed, unconfirmed, or not explicitly released
- **THEN** the response SHALL not include final score, question feedback, reference answer, scoring standard, AI draft, or internal failure detail.

#### Scenario: Student opens a released result
- **WHEN** the owning student opens an assignment with an explicitly released current result
- **THEN** the response SHALL include the derived package's final score, question scores, teacher-confirmed comments, reference answers, and scoring standards
- **AND** it SHALL not include AI raw values, Provider metadata, or teacher edit history.

#### Scenario: Another student requests a release
- **WHEN** a student requests another student's assignment result or attempts to guess a release identity
- **THEN** the system SHALL reject access without returning package content or grading metadata.

### Requirement: Post-deadline resubmissions create new grading candidates without overwriting history
The system SHALL permit a resubmission only when an authorized teacher returns the relevant work after that submission's frozen audience original deadline and grants a new deadline through the canonical review return command. The resulting attempt SHALL create a later immutable assignment submission snapshot, enter a later grading operation, and SHALL not overwrite prior grading, approval, or release history.

#### Scenario: Teacher grants a post-deadline resubmission
- **WHEN** the original assignment deadline has passed and an authorized teacher returns a question with a new deadline
- **THEN** the system SHALL create an auditable resubmission grant and accept a new question attempt only within that grant.

#### Scenario: Resubmission is received after an earlier batch
- **WHEN** a student submits a new attempt under a valid resubmission grant after an earlier grading operation was created
- **THEN** the new attempt SHALL remain outside the earlier operation
- **AND** a later operation SHALL treat it as a new pending grading candidate while preserving prior history.
