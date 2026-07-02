## ADDED Requirements

### Requirement: Teacher review delivery shall preserve class session and grading context
Teacher review, report, grading, evidence, and prep-pack surfaces SHALL carry class, session, report, grading source, and recovery context through every supported action.

#### Scenario: a teacher opens report delivery, grading, evidence review, or prep-pack actions from class review or analytics
- **WHEN** a teacher opens report delivery, grading, evidence review, or prep-pack actions from class review or analytics
- **THEN** the destination SHALL show the originating class/session/report context and the current delivery or grading state.

#### Scenario: the context is missing or stale
- **WHEN** the context is missing or stale
- **THEN** the surface SHALL show a recoverable blocked state instead of jumping to a generic class list, public home page, raw JSON, or internal review route.

### Requirement: Teacher evidence actions shall create auditable next steps
Teacher-facing evidence and diagnosis actions SHALL support review, remediation task creation, report handoff, or prep-pack handoff with visible state.

#### Scenario: a teacher acts on a student evidence or diagnosis item
- **WHEN** a teacher acts on a student evidence or diagnosis item
- **THEN** the UI SHALL show the selected evidence basis, intended next step, operation status, and audit result.

#### Scenario: a mobile teacher surface contains a long report or table
- **WHEN** a mobile teacher surface contains a long report or table
- **THEN** the primary delivery, grading, or remediation action SHALL remain reachable without requiring the teacher to scroll through the full report.
