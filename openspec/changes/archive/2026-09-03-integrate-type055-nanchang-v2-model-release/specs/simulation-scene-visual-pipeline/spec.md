## MODIFIED Requirements

### Requirement: Progressive scene loading with compressed models
Ship model assets SHALL be re-encoded with Draco or meshopt compression in the build pipeline without changing their appearance; scene loading SHALL present water and environment first and mount the ship model with visible progress. When a registered versioned model package provides multiple ship LOD roles, the active quality tier SHALL select the corresponding LOD through the shared scene pipeline, and payload, demo, or collision roles SHALL load only for an explicit consumer.

#### Scenario: Student opens a simulation route on a slow network
- **WHEN** a simulation detail route loads
- **THEN** the environment SHALL render before the ship model is ready
- **AND** model loading SHALL show progress instead of a text-only placeholder

#### Scenario: Quality tier selects a versioned ship LOD
- **WHEN** a registered model package is active and the quality tier is high, medium, or low
- **THEN** the shared loader SHALL select ship LOD0, LOD1, or LOD2 respectively
- **AND** the selection SHALL NOT eagerly load payload, demo, or collision roles

#### Scenario: Automatic quality degradation changes LOD
- **WHEN** sustained frame time causes the scene to degrade to a lower quality tier
- **THEN** the loader SHALL replace only the ship LOD after the lower asset is ready
- **AND** simulation state, ship world transform, camera state, and progress SHALL remain unchanged

## ADDED Requirements

### Requirement: Versioned model integration preserves the simulation drive chain
The shared scene pipeline SHALL treat model-package selection, coordinate adaptation, LOD changes, and animation bindings as visual concerns. They MUST NOT change `SimulationClock`, Rust/WASM stepping, controller behavior, disturbance semantics, telemetry, or Arena scoring.

#### Scenario: Type 055 candidate is enabled
- **WHEN** the versioned Type 055 model package is mounted in the destroyer simulation
- **THEN** the numerical state and control outputs for the same inputs SHALL remain equivalent to the existing model path
- **AND** only visual model loading, transforms, animation, and rendering behavior SHALL differ

### Requirement: Versioned model fallback is handled by the shared loader
The shared loader SHALL retain the current model until a selected LOD is ready and SHALL use the existing ordered destroyer candidates when the versioned candidate fails. Experiment-specific scene code MUST NOT implement a second independent retry state machine.

#### Scenario: Selected LOD fails after a working model is visible
- **WHEN** the requested replacement LOD fails integrity, parsing, or interface validation
- **THEN** the currently visible model SHALL remain mounted
- **AND** the shared loader SHALL report the failure and continue through the declared fallback policy
