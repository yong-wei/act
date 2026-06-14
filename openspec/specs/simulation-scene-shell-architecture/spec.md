# simulation-scene-shell-architecture Specification

## Purpose
Define the scene shell decomposition contract for virtual simulation pages so rendering, controls, telemetry, and runtime wiring can migrate without changing physics ownership or Arena evaluation semantics.
## Requirements
### Requirement: Simulation scenes use explicit shell boundaries

The system SHALL support simulation scene decomposition into `SceneShell`, `ControllerPanel`, `VisualizationLayer`, and `TelemetryBridge` boundaries.

#### Scenario: Simulation detail page declares local tool templates
- **WHEN** a migrated `/simulations/*` detail page renders inside `SimulationShell`
- **THEN** it SHALL declare a simulation-local tool template for its task family
- **AND** the shell SHALL expose collapsible side panel, hint strip, and bottom toolbar markers
- **AND** local tool panels SHALL NOT alter controller algorithms, scene runtime state, or Arena scoring semantics.

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

### Requirement: SimulationShell follows command-deck handoff composition
Simulation detail pages SHALL use `design-handoff.md` as the design source of truth and SHALL use concept 2 as the bounded visual/layout reference for immersive command-deck composition.

#### Scenario: Student opens a simulation detail page
- **WHEN** a student opens a `/simulations/*` detail route
- **THEN** the primary 3D scene or instrument area SHALL be the largest visual layer in the workspace
- **AND** route chrome, telemetry, control, hint, and bottom tool surfaces SHALL read as translucent or glass-like simulation shell surfaces in both light and dark themes
- **AND** the layout SHALL preserve top breadcrumb/context, left platform navigation, central scene, left telemetry/status panel, right control/evaluation panel, bottom local toolbar, and shared Konling dock relationships from the handoff.
- **AND** the top-right shell area SHALL remain user-center oriented rather than adding a simulation-local role switch
- **AND** the shared Konling dock SHALL remain a single bottom-right assistant entry that does not duplicate into a right-side assistant region.

#### Scenario: Local panels collapse
- **WHEN** the user collapses a simulation telemetry or control panel
- **THEN** the panel SHALL leave an explicit restore handle or equivalent reachable control
- **AND** the collapsed state SHALL not cover the scene, bottom toolbar, or AppShell navigation
- **AND** the collapsed and expanded states SHALL be included in visual evidence.
- **AND** collapse controls and restore handles SHALL be keyboard reachable, have visible focus state, and expose understandable labels or accessible names.

#### Scenario: Bottom tools and hints render
- **WHEN** a simulation detail route renders local tools and contextual hints
- **THEN** the bottom toolbar SHALL sit near the bottom workspace edge rather than floating in the middle of the scene
- **AND** any dismissible or contextual hint SHALL sit above the bottom toolbar and SHALL NOT obscure primary controls.

#### Scenario: Glass surfaces render in both themes
- **WHEN** translucent command surfaces render in light or dark theme
- **THEN** panel text, control labels, focus rings, active state, and disabled state SHALL remain readable against the simulation scene
- **AND** visual evidence SHALL include at least one light-theme and one dark-theme detail screenshot that proves the command surfaces do not sacrifice contrast for the glass-like aesthetic.

