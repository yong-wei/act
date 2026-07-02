# audit-remediation-teacher-report-grading Specification

## Purpose
Track the remediation contract for teacher report delivery, grading workbench states, and teacher evidence deep links found during the full-system product-design audit.
## Requirements
### Requirement: Teacher reports must be deliverable workflow objects
The system SHALL allow audited teacher reports to be exported, sent, locked, summarized, and used to create reinforcement tasks with explicit states.

#### Scenario: Report export creates a download or failure state
- **WHEN** a teacher exports an audited class report
- **THEN** the UI records the report version and either starts a download or shows a recoverable export failure

#### Scenario: Missing student send preserves teacher context
- **WHEN** a teacher sends a report to a missing or unauthorized student
- **THEN** the workflow remains in teacher context and explains how to choose a valid student

### Requirement: Grading approval must preserve run context
The system SHALL represent draft, approved, returned, written-back, missing-run, and unsupported-method states in the grading workbench.

#### Scenario: Approve grading run
- **WHEN** a teacher approves a valid grading run
- **THEN** the workbench shows approved state and the intended student-visible writeback target

#### Scenario: Unsupported method is productized
- **WHEN** a grading API returns 404 or 405 for an audited route
- **THEN** the workbench explains the unsupported boundary without redirecting away from the teacher workflow

### Requirement: Teacher remediation must update audit findings
The system SHALL record report delivery and grading remediation status in the audit report with evidence links.

#### Scenario: Teacher finding is closed
- **WHEN** report export, send, grading approval, or student evidence deep link behavior is fixed
- **THEN** the audit entry names the fixed action, evidence file, date, and change id

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
