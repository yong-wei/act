## ADDED Requirements

### Requirement: Commercial shells may retire legacy shells
The system SHALL allow legacy shell components to be removed when a commercial shell replacement preserves route access, role actions, and contextual navigation.

#### Scenario: A legacy shell conflicts with the new hierarchy
- **WHEN** `UnifiedTopBar`, `ArenaPageShell`, teacher layout, admin header, or another legacy shell duplicates navigation or creates inconsistent visual hierarchy
- **THEN** the migration MAY replace it with a commercial shell instead of adapting its visual styling in place.

### Requirement: Workspace shells are derived from shared brand tokens
The system SHALL allow specialized workspace shells for dense tools while requiring them to inherit commercial brand tokens, typography, status colors, and account/cockpit conventions.

#### Scenario: A dense tool renders
- **WHEN** Arena, Control Workbench, adaptive practice, teacher analytics, or admin governance renders a workspace shell
- **THEN** the shell SHALL use shared brand primitives for canvas, panels, instruments, status, navigation, and user actions.
