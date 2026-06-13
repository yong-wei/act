# simulation-scene-shell-architecture Specification

## Purpose
Define the scene shell decomposition contract for virtual simulation pages so rendering, controls, telemetry, and runtime wiring can migrate without changing physics ownership or Arena evaluation semantics.
## Requirements
### Requirement: Simulation scenes use explicit shell boundaries
The system SHALL support simulation scene decomposition into `SceneShell`, `ControllerPanel`, `VisualizationLayer`, and `TelemetryBridge` boundaries.

#### Scenario: Pilot scene is rendered
- **WHEN** the pilot simulation route is opened
- **THEN** the scene SHALL render through the shell boundary while preserving the existing user-visible route behavior

#### Scenario: Detail page shell is rendered
- **WHEN** an existing `/simulations/*` detail page is wrapped by `SimulationShell`
- **THEN** the existing simulation runtime component SHALL remain the scene owner
- **AND** the page shell SHALL only provide route chrome, navigation, return target, and workspace-zone placement.

### Requirement: Physics behavior is preserved during shell migration
The system SHALL preserve existing Rust/WASM runtime facade calls and physical model behavior during the pilot shell migration.

#### Scenario: Pilot controller input changes
- **WHEN** the user changes controller inputs in the migrated pilot scene
- **THEN** the scene SHALL continue to drive the same underlying model behavior as before the shell split

### Requirement: Telemetry bridge emits protocol summaries
The system SHALL emit protocol-compatible telemetry summaries from the pilot scene through a dedicated telemetry bridge.

#### Scenario: Pilot run completes
- **WHEN** the migrated pilot run completes
- **THEN** the telemetry bridge SHALL produce summary fields compatible with `SimulationTrace v1`

### Requirement: Cruise pilot preserves model relation boundaries
The system SHALL document and preserve the relation between the high-fidelity Cruise scene and any simplified Arena cruise-roll object during the pilot shell migration.

#### Scenario: Cruise shell emits telemetry
- **WHEN** the Cruise pilot emits telemetry or evaluation summaries
- **THEN** the summaries SHALL identify the Cruise scene model relation separately from the simplified Arena cruise-roll object and SHALL NOT imply that both objects share the same official evaluation model

