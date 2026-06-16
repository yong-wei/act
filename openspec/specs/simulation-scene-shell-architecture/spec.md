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

### Requirement: Simulation resources use internal theme primitives
Simulation detail pages SHALL render simulation-internal panels, HUD labels, metric tiles, hint strips, local toolbars, restore handles, and control surfaces through approved simulation theme primitives or token mappings.

#### Scenario: Dark theme simulation detail renders
- **WHEN** a student opens any migrated `/simulations/*` detail route in dark theme
- **THEN** resource-internal panels and controls SHALL use dark-template simulation primitives rather than hard-coded white or slate local palettes
- **AND** text, focus rings, active states, disabled states, and status colors SHALL remain readable against the scene.

#### Scenario: Light theme simulation detail renders
- **WHEN** a student opens any migrated `/simulations/*` detail route in light theme
- **THEN** resource-internal panels and controls SHALL use light-template simulation primitives
- **AND** the result SHALL remain visually connected to the AppShell without introducing a second page-local design system.

### Requirement: Simulation scenes expose theme-aware visual parameters
Simulation scenes SHALL define light and dark visual parameters for background, sky, water or ground surface, grid, fog, labels, HUD overlays, and emphasis markers where those elements exist.

#### Scenario: Theme is switched on a scene route
- **WHEN** the user switches between light and dark theme on a simulation detail route
- **THEN** the scene SHALL update relevant visual parameters instead of leaving the same pale scene embedded in both themes
- **AND** the change SHALL NOT alter physics state, controller state, Arena scoring, or trace semantics.

### Requirement: Simulation theme acceptance covers every active detail route
Simulation theme acceptance SHALL include all active simulation detail routes.

#### Scenario: Theme evidence is reviewed
- **WHEN** this change is reviewed
- **THEN** evidence SHALL include `/simulations/destroyer`, `/simulations/lng`, `/simulations/container`, `/simulations/cruise`, `/simulations/drilling`, `/simulations/icebreaker`, and `/simulations/dredger`
- **AND** each route SHALL have desktop and mobile screenshots in light and dark themes.

### Requirement: Simulation scene chrome does not duplicate platform navigation
Simulation detail scenes SHALL NOT render resource-local upward navigation or decorative route abbreviations inside the primary scene frame after command-deck migration.

#### Scenario: Simulation detail route renders
- **WHEN** a user opens any migrated `/simulations/*` detail route
- **THEN** the scene frame SHALL NOT show a top-left "返回上一层" or equivalent in-scene back control
- **AND** the scene frame SHALL NOT show a top-right decorative simulation abbreviation such as `LNG/OBE`
- **AND** upward navigation and simulation identity SHALL be provided by AppShell breadcrumb, route title, catalog metadata, or approved shell context.

### Requirement: Simulation panels align to the top command area
Simulation telemetry/status and control/evaluation panels SHALL align to the upper simulation workspace while preserving scene visibility and bottom toolbar access.

#### Scenario: Desktop command-deck layout renders
- **WHEN** a user opens a migrated simulation detail route on desktop
- **THEN** the left telemetry/status panel and right control/evaluation panel SHALL begin near the top of the simulation workspace below the shell header safe area
- **AND** the panels SHALL NOT float at the vertical midpoint as unrelated cards
- **AND** the bottom local toolbar and hint strip SHALL remain unobscured.

#### Scenario: Mobile command-deck layout renders
- **WHEN** a user opens a migrated simulation detail route on 320px to 390px mobile
- **THEN** telemetry/status and control/evaluation access SHALL remain reachable through compact panels, sheets, tabs, or restore handles
- **AND** those controls SHALL NOT hide the primary scene as a squeezed desktop sidebar.

### Requirement: Cruise simulation uses scene-first command-deck geometry
`/simulations/cruise` SHALL use the same scene-first command-deck geometry as the other active simulation detail routes.

#### Scenario: Cruise detail route renders on desktop
- **WHEN** a user opens `/simulations/cruise` on desktop
- **THEN** the primary scene SHALL be the largest first-viewport layer and SHALL use comparable width and visual priority to the other simulation details
- **AND** mission context, command actions, support content, and evidence content SHALL NOT force the scene into a narrow, tall secondary column.

#### Scenario: Cruise detail route renders on mobile
- **WHEN** a user opens `/simulations/cruise` on mobile
- **THEN** the primary simulation scene SHALL appear before large explanatory cards
- **AND** contextual or evidence content SHALL move into compact, collapsible, or below-scene surfaces that do not block the first scene experience.

### Requirement: Command-deck contract applies to all active simulation details
The command-deck visual and interaction contract SHALL apply to every active `/simulations/*` detail route, not only representative pilot routes.

#### Scenario: Active simulation route is opened
- **WHEN** a user opens any active simulation detail route
- **THEN** the route SHALL provide scene-first layout, top shell context, top-aligned side panels, bottom local toolbar, shared Konling dock, light/dark template parity, and mobile-reachable local controls
- **AND** the route SHALL NOT rely on an undocumented route-specific shell geometry.

### Requirement: New simulation details enter the full visual matrix
New simulation detail routes SHALL be added to the full visual QA matrix when they become active.

#### Scenario: New simulation route is registered
- **WHEN** a new active simulation detail route is added to the simulation catalog or route registry
- **THEN** the full simulation visual QA matrix SHALL include the new route in desktop/mobile and light/dark themes
- **AND** the route SHALL identify its local panel template and scene theme parameter set.

