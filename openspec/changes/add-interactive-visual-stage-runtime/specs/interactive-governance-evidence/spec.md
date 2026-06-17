## ADDED Requirements

### Requirement: Visual stage lifecycle evidence is recorded
Visual stage modules SHALL record enough lifecycle evidence for teacher diagnostics and implementation audit.

#### Scenario: Student views a visual stage
- **WHEN** a student opens a stage module
- **THEN** evidence SHALL include lesson id, step id, module id, stage id, visible layer ids, release state, reveal state, role, theme, and timestamp
- **AND** this evidence SHALL be available to teacher diagnostics.

#### Scenario: Teacher changes stage reveal state
- **WHEN** a teacher releases, hides, reveals, jumps, or highlights a stage layer
- **THEN** the event SHALL be recorded with stage id, target layer ids, previous state, next state, actor role, and timestamp
- **AND** student-visible state SHALL be recoverable after refresh.
