## ADDED Requirements

### Requirement: Teacher classroom waiting state is standardized
Interactive course teacher start flow SHALL use a standardized classroom waiting state before projection runtime begins.

#### Scenario: Teacher creates a classroom session
- **WHEN** a teacher creates or opens a classroom waiting page
- **THEN** the page SHALL show the classroom QR code, classroom code, joined student count, and `开始上课` action
- **AND** it SHALL remain visually aligned with the shared AppShell and course entry shell.

#### Scenario: Teacher starts class
- **WHEN** the teacher activates `开始上课`
- **THEN** the flow SHALL enter the teacher projection runtime
- **AND** the waiting page SHALL NOT continue to display as if projection has already started.

### Requirement: Teacher waiting page follows accepted Product Design references
Teacher classroom waiting implementation SHALL prove visual alignment with the accepted Product Design handoff and waiting-page concept.

#### Scenario: Waiting page visual QA runs
- **WHEN** the waiting page is accepted
- **THEN** QA evidence SHALL cite `artifacts/product-design-audits/interactive-learning-2026-06-14/design-handoff.md`
- **AND** it SHALL cite `concepts/revised/02-teacher-classroom-qr-waiting.png`
- **AND** Product Design `design-qa` SHALL report `final result: passed`.
