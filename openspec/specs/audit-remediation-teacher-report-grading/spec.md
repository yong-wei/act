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
