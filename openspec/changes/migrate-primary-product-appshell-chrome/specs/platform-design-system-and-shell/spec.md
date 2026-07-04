## ADDED Requirements

### Requirement: Primary product modules share one AppShell chrome
Primary product entry routes SHALL use the same AppShell navigation rail, top bar, breadcrumb convention, and account/theme action placement.

#### Scenario: Primary product route renders
- **WHEN** `/knowledge`, `/interactive-learning`, `/assessment/adaptive-practice`, `/arena`, `/simulations`, `/interactive-learning/control-workbench`, or `/profile` renders
- **THEN** the route SHALL render the canonical collapsible left navigation rail
- **AND** the route SHALL render top-right actions as exactly the shell-owned theme switch followed by the role-aware Personal Center action.

#### Scenario: Knowledge Graph renders
- **WHEN** the Knowledge Graph route renders
- **THEN** the top bar SHALL include a breadcrumb trail that orients the user inside the platform
- **AND** the graph canvas SHALL NOT replace shell breadcrumbs with canvas-local controls.

#### Scenario: Learning Path renders
- **WHEN** the Learning Path surface renders through `/assessment/adaptive-practice`
- **THEN** path management commands SHALL render as local page commands
- **AND** they SHALL NOT occupy the shell account/theme action area.

#### Scenario: Control Workbench renders
- **WHEN** the Control Workbench renders
- **THEN** return-to-exploration or return-to-challenge actions SHALL be expressed through breadcrumbs, contextual return, or local command bars
- **AND** they SHALL NOT appear in the shell top-right account/theme action pair.

#### Scenario: Arena and Virtual Simulation render
- **WHEN** Arena or Virtual Simulation routes render
- **THEN** Personal Center SHALL appear after the theme switch with the same style as other primary routes
- **AND** page-specific controls SHALL not reorder or restyle that pair.

#### Scenario: Primary route responsive states are checked
- **WHEN** primary routes are visually validated
- **THEN** validation SHALL cover 1440, 1280, 1024, 768, 390, and 320 viewport widths
- **AND** it SHALL verify rail collapse/expand, mobile drawer open/closed, breadcrumb truncation, right-action wrapping, no overlap, and no horizontal overflow.
