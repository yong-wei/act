## ADDED Requirements

### Requirement: Interactive lessons use a unified LessonRuntimeShell
Interactive lesson runtime routes SHALL use a unified LessonRuntimeShell for student, guest/demo, teacher projection, and invalid-session states.

#### Scenario: Student or guest runtime renders
- **WHEN** a student or guest/demo lesson runtime opens
- **THEN** the shell SHALL prioritize the current lesson content, answer affordance where allowed, feedback, and progress
- **AND** it SHALL NOT show teacher-only submission overview, evidence status, class analytics, or teacher controls.

#### Scenario: Teacher projection runtime renders
- **WHEN** a teacher projection lesson runtime opens
- **THEN** teaching content, diagrams, question stems, and interaction modules SHALL dominate the visual hierarchy
- **AND** student answer input boxes SHALL NOT render
- **AND** right-side tools SHALL be collapsed by default rather than a permanent drawer.

#### Scenario: Teacher runtime navigation renders
- **WHEN** teacher projection runtime navigation is shown
- **THEN** the bottom course navigation SHALL be compact and visually secondary
- **AND** it SHALL include previous/next, BOPPPS stage indicator, page count, and page-jump dropdown
- **AND** the top bar SHALL NOT duplicate the next-page action.

### Requirement: LessonRuntimeShell follows accepted Product Design references
Lesson runtime implementations SHALL prove visual alignment with the accepted Product Design handoff and runtime concepts.

#### Scenario: Runtime visual QA runs
- **WHEN** runtime shell migration is accepted
- **THEN** QA evidence SHALL cite `artifacts/product-design-audits/interactive-learning-2026-06-14/design-handoff.md`
- **AND** it SHALL cite `concepts/revised/03-student-guest-runtime.png` and `concepts/revised/06-teacher-projection-runtime-compact-navigation.png`
- **AND** Product Design `design-qa` SHALL report `final result: passed` for student/guest and teacher projection states.
