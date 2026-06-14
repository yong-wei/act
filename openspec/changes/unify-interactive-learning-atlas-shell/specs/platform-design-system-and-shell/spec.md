## ADDED Requirements

### Requirement: Interactive learning atlas routes use the shared shell
Interactive learning atlas routes SHALL use the shared platform shell, collapsed navigation contract, and shared floating assistant model.

#### Scenario: Interactive learning atlas route renders on desktop
- **WHEN** `/interactive-learning`, `/interactive-learning/courses`, `/interactive-learning/chapter-components`, or `/interactive-learning/cross-domain-exploration` renders at a desktop viewport
- **THEN** the page SHALL use the shared AppShell with default collapsed navigation
- **AND** the main page content SHALL expand as a fluid workspace rather than relying on a full-page fixed centered container
- **AND** the shared Konling floating dock SHALL remain the assistant entry.

#### Scenario: Interactive learning atlas route renders on mobile
- **WHEN** an atlas route renders at 320px width
- **THEN** global navigation SHALL move into the shared mobile navigation pattern
- **AND** the primary learning content SHALL remain reachable without horizontal overflow.

### Requirement: Interactive learning atlas follows accepted Product Design references
Interactive learning atlas implementation SHALL prove visual alignment with the accepted Product Design handoff and atlas concept images.

#### Scenario: Atlas visual QA runs
- **WHEN** the atlas route family is accepted
- **THEN** QA evidence SHALL cite `artifacts/product-design-audits/interactive-learning-2026-06-14/design-handoff.md`
- **AND** it SHALL cite `concepts/01-learning-atlas-course-catalog.png` and `concepts/revised/01-course-catalog-theory-practice.png`
- **AND** Product Design `design-qa` SHALL report `final result: passed`.
