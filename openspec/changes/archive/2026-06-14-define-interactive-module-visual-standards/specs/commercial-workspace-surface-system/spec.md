## ADDED Requirements

### Requirement: Interactive module visual standards fit LessonRuntimeShell
Interactive module chrome SHALL fit the LessonRuntimeShell projection, desktop, mobile, light, and dark presentation modes.

#### Scenario: Module renders in projection mode
- **WHEN** a module appears on a teacher projection page
- **THEN** typography, spacing, action placement, and panel geometry SHALL remain readable for classroom projection
- **AND** controls SHALL not reduce the main teaching content below the intended visual priority.

#### Scenario: Module visual QA runs
- **WHEN** module visual standards are accepted
- **THEN** QA evidence SHALL cite `artifacts/product-design-audits/interactive-learning-2026-06-14/design-handoff.md`
- **AND** student and guest module-state evidence SHALL cite `concepts/revised/03-student-guest-runtime.png`
- **AND** teacher-control and projection module-state evidence SHALL cite `concepts/revised/06-teacher-projection-runtime-compact-navigation.png`
- **AND** Product Design `design-qa` SHALL report `final result: passed` for representative module states.
