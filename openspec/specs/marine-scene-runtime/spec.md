# marine-scene-runtime Specification

## Purpose
TBD - created by archiving change unify-marine-scene-runtime. Update Purpose after archive.
## Requirements
### Requirement: Frame snapshots preserve authoritative simulation state
The marine scene SHALL consume one read-only frame snapshot and SHALL NOT advance or modify the numerical model.

#### Scenario: Frame consumers update
- **WHEN** the renderer advances a frame
- **THEN** water, hull, wake, overlays and lighting consume the same snapshot while SimulationClock and Rust/WASM retain authority

### Requirement: World coordinates survive render-origin changes
The scene SHALL distinguish world coordinates from render-local coordinates and SHALL preserve the world anchoring of water phases and environment objects.

#### Scenario: Origin is recentered
- **WHEN** the render origin or following camera moves
- **THEN** the same world point and time retain the same wave phase and world objects retain their physical locations

### Requirement: Pose ownership is explicit per degree of freedom
Each heave, pitch and roll component SHALL declare telemetry, visual-water or fixed ownership; quality and lighting presets SHALL NOT change that ownership.

#### Scenario: Cruise roll is numerical
- **WHEN** a cruise frame supplies a numerical roll angle
- **THEN** the visual rig uses that angle without replacing it or adding another roll response

### Requirement: Visual timing is shared and injectable
The scene SHALL define pause, rate, reset and seek policies for its shared visual clock independently of numerical stepping.

#### Scenario: A deterministic visual capture is replayed
- **WHEN** the same visual time, seed, epoch and inputs are supplied
- **THEN** all participating visual modules reproduce the same state without reading separate wall clocks

