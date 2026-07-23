## MODIFIED Requirements

### Requirement: Simulation scenes expose theme-aware visual parameters
Simulation scenes SHALL define light and dark visual parameters for panels, HUD overlays, grid, labels, and emphasis markers where those chrome elements exist; the realistic scene body (sky, water, fog, lighting) SHALL instead be driven by the selected environment preset and SHALL NOT switch with platform theme.

#### Scenario: Theme is switched on a scene route
- **WHEN** the user switches between light and dark theme on a simulation detail route
- **THEN** panels, HUD overlays, grid, labels, and emphasis markers SHALL update their visual parameters instead of remaining locked to one palette
- **AND** the scene body SHALL keep its selected environment preset
- **AND** the change SHALL NOT alter physics state, controller state, Arena scoring, or trace semantics.
