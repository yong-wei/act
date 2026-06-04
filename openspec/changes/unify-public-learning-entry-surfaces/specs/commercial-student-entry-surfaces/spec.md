## ADDED Requirements

### Requirement: Public and learning entries use one premium map
The system SHALL render homepage, login, Interactive Learning, course catalog, course entry, and simulation hub as one coherent premium entry family.

#### Scenario: Student moves from homepage to learning entry
- **WHEN** a student opens homepage, Interactive Learning, course catalog, or simulation hub
- **THEN** the visible hierarchy SHALL preserve the same brand language, intent grouping, route frame, theme behavior, and cockpit/account semantics
- **AND** the page SHALL NOT fall back to unrelated generic card-grid styling.

### Requirement: Course and simulation entries show structured learning intent
The system SHALL organize course and simulation entry surfaces by module, scenario, progression, status, and recommended action where data is available.

#### Scenario: Course catalog renders
- **WHEN** the course catalog displays modules or lessons
- **THEN** it SHALL expose module progression, course type, launch action, and learning intent through a coherent map or path layout
- **AND** repeated cards MAY be used only for actual repeated course items.

#### Scenario: Simulation hub renders
- **WHEN** the simulation hub displays ship scenarios
- **THEN** existing ship imagery SHALL be treated as primary scenario identity
- **AND** difficulty, course fit, task status, and launch actions SHALL use shared entry and status semantics.
