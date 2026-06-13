## MODIFIED Requirements

### Requirement: Simulation scenes use explicit shell boundaries
The system SHALL support simulation scene decomposition into `SceneShell`, `ControllerPanel`, `VisualizationLayer`, and `TelemetryBridge` boundaries.

#### Scenario: Pilot scene is rendered
- **WHEN** the pilot simulation route is opened
- **THEN** the scene SHALL render through the shell boundary while preserving the existing user-visible route behavior

#### Scenario: Detail page shell is rendered
- **WHEN** an existing `/simulations/*` detail page is wrapped by `SimulationShell`
- **THEN** the existing simulation runtime component SHALL remain the scene owner
- **AND** the page shell SHALL only provide route chrome, navigation, return target, and workspace-zone placement.
