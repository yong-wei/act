## ADDED Requirements

### Requirement: Assignment question feedback preserves review and resubmission context
Student remediation flows SHALL carry assignment revision, submission attempt, question, criterion, approved review, source annotation, return reason, resubmission target, and return route through supported destinations.

#### Scenario: Student follows an approved remediation action
- **WHEN** a student opens practice, resource, mission, evidence, growth, or portfolio from an approved assignment criterion
- **THEN** the destination SHALL identify the assignment, question, criterion, required action, approved feedback source, and route back to the assignment detail.

#### Scenario: Student follows a returned-question action
- **WHEN** feedback requires question resubmission
- **THEN** the action SHALL target the returned question and current allowed answer attempt
- **AND** it SHALL NOT open a generic mission or stale submission context.

### Requirement: Assignment feedback closure reports both learning and grading state
The student and teacher closure views SHALL distinguish feedback read, remediation adopted, question revising, question resubmitted, regraded, approved, and evidence-written states.

#### Scenario: Resubmission is approved
- **WHEN** a returned question is resubmitted and a new review is approved
- **THEN** the closure view SHALL preserve prior feedback and attempts, identify the current approved result, and show whether governed evidence writeback completed.

#### Scenario: Feedback context becomes unavailable
- **WHEN** an assignment, review, annotation, or remediation destination can no longer be resolved
- **THEN** the student SHALL receive a recoverable missing-context state with a safe return to the assignment or Task Center.
