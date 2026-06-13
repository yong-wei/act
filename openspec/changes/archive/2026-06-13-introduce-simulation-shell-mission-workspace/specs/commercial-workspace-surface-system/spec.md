## MODIFIED Requirements

### Requirement: Workspace zones are available through AppShell
Commercial workspace zones SHALL be expressible through the shared AppShell contract when a route declares a dense workspace archetype.

#### Scenario: Mission workspace renders
- **WHEN** a Control Workbench, Arena task, simulation, or interactive runtime route uses the `mission-workspace` archetype
- **THEN** AppShell SHALL support context header, command bar, instrument area, evidence rail, support drawer, status rail, and local tool slots
- **AND** feature content SHALL not need a separate page shell to express those zones.

#### Scenario: Simulation detail route renders
- **WHEN** a `/simulations/*` detail route renders through the shared simulation shell
- **THEN** it SHALL expose route-level breadcrumbs, theme switching, personal-center access, return target metadata, and the primary simulation scene as the main instrument area
- **AND** the shell SHALL NOT compute physics state, controller state, telemetry truth, or Arena official evaluation truth.
