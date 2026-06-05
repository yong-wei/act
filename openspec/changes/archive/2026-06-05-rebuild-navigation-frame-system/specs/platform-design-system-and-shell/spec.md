## ADDED Requirements

### Requirement: Platform shell owns navigation frame rendering
The platform shell SHALL own rendering of global orientation, role cockpit actions, contextual route trace, and local tool slots.

#### Scenario: Legacy shell remains
- **WHEN** a route still uses `UnifiedTopBar`, `ArenaPageShell`, teacher layout, admin console header, or another legacy shell
- **THEN** the route inventory SHALL mark that shell as adapted, retained, or scheduled for retirement
- **AND** undocumented shell duplication SHALL fail governance.

### Requirement: Mobile AppShell provides equivalent navigation access
The platform shell SHALL provide mobile access that is equivalent to the desktop route family navigation.

#### Scenario: AppShell renders below the mobile breakpoint
- **WHEN** a route exposes more navigation destinations than can fit comfortably in the first viewport
- **THEN** the shell SHALL provide drawer, sheet, command, or tab access rather than horizontal-scroll-only navigation
- **AND** the current route, parent route, and return target SHALL remain visible.

### Requirement: Floating controls use one dock information architecture
The platform shell SHALL expose one dock model for Konling, management, and settings controls.

#### Scenario: Fixed controls render
- **WHEN** AI assistant, settings, management, or page-local floating controls are available
- **THEN** they SHALL register with the shared dock model
- **AND** separate right-bottom fixed systems SHALL NOT render concurrently outside the dock.

#### Scenario: Dock renders over a task workspace
- **WHEN** Konling, page tools, settings, management controls, issue badges, or support drawers are visible
- **THEN** the dock SHALL prove safe-area, z-index, keyboard reachability, and collision behavior at 1440px and 320px
- **AND** the dock SHALL NOT obscure primary task controls, graph canvases, forms, charts, or report labels.
