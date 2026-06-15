## ADDED Requirements

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
