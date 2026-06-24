## MODIFIED Requirements

### Requirement: Simulation scenes use explicit shell boundaries

The system SHALL support simulation scene decomposition into `SceneShell`, `ControllerPanel`, `VisualizationLayer`, and `TelemetryBridge` boundaries.

#### Scenario: Simulation detail page declares local tool templates
- **WHEN** a migrated `/simulations/*` detail page renders inside `SimulationShell`
- **THEN** it SHALL declare a simulation-local tool template for its task family
- **AND** the shell SHALL expose collapsible side panel, hint strip, and bottom toolbar markers
- **AND** local tool panels SHALL NOT alter controller algorithms, scene runtime state, or Arena scoring semantics.
