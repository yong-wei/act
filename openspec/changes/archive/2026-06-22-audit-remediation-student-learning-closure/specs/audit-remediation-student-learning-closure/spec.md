## ADDED Requirements

### Requirement: Feedback tasks must have a student-visible lifecycle
The system SHALL represent report feedback tasks with returned, read, adopted, revising, completed, written-back, and teacher-visible states.

#### Scenario: Student adopts returned feedback
- **WHEN** a student opens a returned report feedback item and adopts a recommended action
- **THEN** the page records the adopted state and shows the selected next task

#### Scenario: Completion writes back to evidence
- **WHEN** a student completes an assignment-scoped task
- **THEN** evidence, growth, or portfolio state reflects the completion or explains why writeback is unavailable

### Requirement: Assignment context must survive across student destinations
The system SHALL carry assignment, criterion, source feedback, return target, and completion target through adaptive practice, missions, resources, evidence, growth, and portfolio pages.

#### Scenario: Target page explains scoped context
- **WHEN** a student follows a feedback target link
- **THEN** the destination shows the feedback source, criterion, required action, and return path

#### Scenario: Missing assignment is not a generic page
- **WHEN** a feedback target references a missing assignment or unsupported API
- **THEN** the destination shows a recoverable missing-context state

### Requirement: Student closure fixes must be audit-linked
The system SHALL update the audit report only after student lifecycle, writeback, and return-path evidence has been captured.

#### Scenario: Student finding is closed
- **WHEN** a student feedback or portfolio finding is remediated
- **THEN** the report entry cites the original batch finding and new evidence for adoption, completion, and writeback
