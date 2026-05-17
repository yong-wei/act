## ADDED Requirements

### Requirement: Arena-bound workbench renders challenge context without the legacy shell frame
When the unified control workbench is opened from an Arena challenge, the page SHALL preserve Arena challenge context while removing the legacy workbench shell framing.

#### Scenario: Challenge workbench shows session status first
- **WHEN** a student opens `/interactive-learning/control-workbench` with an `arenaTask` parameter
- **THEN** the workbench SHALL render the session or challenge status at the top of the page
- **AND** the status area SHALL appear before the analysis panels.

#### Scenario: Challenge workbench uses full page width
- **WHEN** a student opens an Arena-bound workbench on a desktop-width viewport
- **THEN** the analysis panel area SHALL use the full available content width
- **AND** it SHALL NOT be nested inside the old titled workbench shell frame.

#### Scenario: Challenge context survives shell removal
- **WHEN** the workbench shell frame is removed for an Arena-bound challenge
- **THEN** the page SHALL still show enough challenge context for the student to identify the active task
- **AND** official submission controls SHALL remain bound to the same `arenaTask` value.
