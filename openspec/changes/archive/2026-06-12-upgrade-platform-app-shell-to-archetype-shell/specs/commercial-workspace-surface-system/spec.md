## ADDED Requirements

### Requirement: Workspace zones are available through AppShell
Commercial workspace zones SHALL be expressible through the shared AppShell contract when a route declares a dense workspace archetype.

#### Scenario: Mission workspace renders
- **WHEN** a Control Workbench, Arena task, simulation, or interactive runtime route uses the `mission-workspace` archetype
- **THEN** AppShell SHALL support context header, command bar, instrument area, evidence rail, support drawer, status rail, and local tool slots
- **AND** feature content SHALL not need a separate page shell to express those zones.
