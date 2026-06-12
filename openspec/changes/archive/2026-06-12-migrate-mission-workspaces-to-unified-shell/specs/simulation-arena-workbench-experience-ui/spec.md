## ADDED Requirements

### Requirement: Arena and Control Workbench share mission route continuity
Arena and Control Workbench UI SHALL preserve route continuity through the unified mission shell.

#### Scenario: Control Workbench opens from Arena context
- **WHEN** a student opens Control Workbench from an Arena challenge or publication context
- **THEN** the unified shell SHALL display the Arena-derived route trace or return target
- **AND** returning from the workbench SHALL target the originating Arena context rather than a generic entry page.

#### Scenario: Control Workbench opens directly
- **WHEN** a student opens Control Workbench directly
- **THEN** the unified shell SHALL show the default mission context, object selection, and primary instrument area without requiring Arena context.
