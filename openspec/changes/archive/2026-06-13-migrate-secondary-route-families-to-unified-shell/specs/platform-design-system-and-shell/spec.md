## ADDED Requirements

### Requirement: Descendant pages inherit approved shell frames
The platform shell system SHALL require first-hop and descendant product pages to render through `AppShell`, an approved workspace shell, or a registered temporary exception with a removal condition.

#### Scenario: User follows a first-hop page action
- **WHEN** a user opens a primary action from Interactive Learning, Arena, Control Workbench, knowledge graph, data center, simulation, teacher, admin, or report routes
- **THEN** the destination SHALL preserve the approved shell frame, role label, contextual route trace, theme controls, and mobile navigation model
- **AND** the destination SHALL NOT replace the shell with an unregistered page-local topbar, sidebar, breadcrumb, or fixed header.

#### Scenario: Descendant route cannot migrate immediately
- **WHEN** a descendant route must keep a runtime-specific shell during migration
- **THEN** the route SHALL declare the approved shell disposition, owner, affected capability, expiry, and removal condition in the route ledger
- **AND** visual governance SHALL treat the route as an exception rather than an untracked success.

### Requirement: Content width follows route archetype
Route frames SHALL define whether page content is reading-width, atlas-width, or fluid workspace-width rather than relying on page-local full-page `max-w` containers.

#### Scenario: Collapsible navigation changes width
- **WHEN** AppShell navigation collapses on a learning, mission, knowledge, data, teacher, admin, or report route
- **THEN** the primary workspace region SHALL expand according to the route archetype
- **AND** any narrow reading constraint SHALL apply only to text-heavy inner blocks, not to the full route canvas.

### Requirement: Local tools use shell-compatible collapse behavior
Feature-owned local tools SHALL render in shell-compatible slots, panels, drawers, or collapsible overlays instead of permanent unregistered overlays.

#### Scenario: Workspace local tools are present
- **WHEN** filters, legends, directories, view switches, resource panels, evidence panels, or runtime controls render on a migrated route
- **THEN** those controls SHALL expose open, closed, and mobile states that do not overlap global navigation, page actions, or the floating dock
- **AND** their visible state SHALL be testable through DOM metadata or visual evidence.
