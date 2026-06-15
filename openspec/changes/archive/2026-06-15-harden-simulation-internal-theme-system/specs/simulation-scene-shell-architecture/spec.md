## ADDED Requirements

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
