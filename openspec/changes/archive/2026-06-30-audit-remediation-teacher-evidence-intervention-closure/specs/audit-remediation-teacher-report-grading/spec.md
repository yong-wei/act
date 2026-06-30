## ADDED Requirements

### Requirement: Teacher evidence actions shall create durable interventions
Teacher-facing report, grading, review, and student evidence surfaces SHALL turn follow-up suggestions into durable intervention actions or explicit non-writeback states.

#### Scenario: a teacher creates a follow-up from evidence
- **WHEN** a teacher sends feedback, approves grading writeback, creates a reinforcement task, or generates a remedial path from report or evidence context
- **THEN** the system SHALL persist an action record with teacher, student, class/session when available, source evidence refs, status, and student-facing target.
- **AND** the originating surface SHALL show the resulting status and recovery action without losing the original context.

#### Scenario: learner state or path context is incomplete
- **WHEN** learner state, path execution, or evidence mapping is missing
- **THEN** the system SHALL still preserve cited evidence and allow supported follow-up actions at reduced personalization confidence.
- **AND** unsupported actions SHALL show a specific blocked reason instead of a generic failure.

### Requirement: Teacher interventions shall be visible to students
Teacher-created follow-up actions SHALL become visible in the appropriate student path, task, feedback, or evidence view.

#### Scenario: a teacher action is accepted
- **WHEN** a teacher action writes back successfully
- **THEN** the student SHALL see the feedback, task, path update, or evidence timeline item with source context and completion affordance.

#### Scenario: a teacher action is pending or blocked
- **WHEN** writeback is pending, partially accepted, or blocked
- **THEN** teacher and student-facing views SHALL use consistent status language and SHALL NOT imply completion.

### Requirement: Teacher audit closure shall be evidence backed
Teacher report, grading, evidence, and intervention findings SHALL be closed only with linked implementation evidence.

#### Scenario: audit report is updated
- **WHEN** this change updates the Product Design audit report
- **THEN** every closed finding id SHALL reference the implemented surface, test or browser evidence, and residual scope.
