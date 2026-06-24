## ADDED Requirements

### Requirement: Standard interactive modules use registered visual chrome
Standard interactive course module kinds SHALL render through registered shared visual chrome rather than unregistered course-local variants.

#### Scenario: A standard module renders in runtime
- **WHEN** a content, media, formula, table, code, choice, multiple choice, sorting, pairing, drag/match, task, parameter input, graph hotspot, short answer, or assessment module renders
- **THEN** it SHALL use registered shared visual chrome for that module category
- **AND** course-local unregistered chrome SHALL fail acceptance for standard module kinds.

#### Scenario: Teacher controls render for a module
- **WHEN** a teacher releases interaction, pauses answers, progressively reveals content, shows a reference, or reviews submissions
- **THEN** the control SHALL attach to the corresponding interaction module
- **AND** pages with multiple interactions SHALL NOT centralize all module-specific controls in one global side panel.

#### Scenario: Module role and state variants render
- **WHEN** a module is shown in student, guest, teacher, unavailable, submitted, feedback, or reference-visible state
- **THEN** the visual chrome SHALL preserve the role contract and state truth
- **AND** teacher-only states SHALL NOT appear in student or guest views.
