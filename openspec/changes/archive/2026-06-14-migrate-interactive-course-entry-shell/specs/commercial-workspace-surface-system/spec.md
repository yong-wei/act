## ADDED Requirements

### Requirement: Interactive course entry uses CourseEntryShell
Concrete interactive course entry routes SHALL use a unified CourseEntryShell that fits the platform commercial workspace model.

#### Scenario: User opens a concrete interactive course entry
- **WHEN** `/interactive-learning/courses/unit-*` renders
- **THEN** the page SHALL show course identity, BOPPPS structure, entry actions, resources, and knowledge-path context through a unified CourseEntryShell
- **AND** it SHALL NOT rely on `premium-lesson-*` as the primary page shell.

#### Scenario: Course entry role actions render
- **WHEN** teacher start, student join, guest/demo, or self-study actions are available
- **THEN** those actions SHALL be clearly separated by role and intent
- **AND** student or guest entry contexts SHALL NOT show teacher-only class analytics, submission overview, or evidence status.

### Requirement: CourseEntryShell follows accepted Product Design references
Course entry implementations SHALL prove visual alignment with the accepted Product Design handoff and CourseEntryShell concept.

#### Scenario: Course entry visual QA runs
- **WHEN** course entry migration is accepted
- **THEN** QA evidence SHALL cite `artifacts/product-design-audits/interactive-learning-2026-06-14/design-handoff.md`
- **AND** it SHALL cite `concepts/02-course-entry-shell.png`
- **AND** Product Design `design-qa` SHALL report `final result: passed`.
