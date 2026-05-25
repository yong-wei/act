# simulation-scene-trace-protocol Specification

## Purpose
TBD - created by archiving change standardize-simulation-scene-and-trace-protocol. Update Purpose after archive.
## Requirements
### Requirement: SceneSpec v1 describes simulation scenes
The system SHALL define `SceneSpec v1` as the canonical description for a virtual simulation scene, including scene identity, model identity, disturbance policy, evaluation policy, assets, telemetry, replay metadata, and evidence governance metadata.

#### Scenario: Scene is launched from a standalone route
- **WHEN** a standalone `/simulations/*` route resolves its scene configuration
- **THEN** the scene configuration SHALL be representable as `SceneSpec v1`

#### Scenario: Scene is launched from a course resource
- **WHEN** a DB BOPPPS lesson item launches a simulation resource
- **THEN** the resource configuration SHALL resolve to the same `SceneSpec v1` contract with course/class/session context attached separately

### Requirement: SimulationTrace v1 separates samples from summaries
The system SHALL define `SimulationTrace v1` with a run envelope, sample cadence, high-frequency trace reference, compact summary metrics, seed/version metadata, and replay checksum.

#### Scenario: Simulation run completes
- **WHEN** a simulation run completes
- **THEN** the recorded trace envelope SHALL include scene id, scenario id, protocol version, runtime version, model version, sample cadence, summary metrics, and checksum fields

#### Scenario: Learning evidence is materialized
- **WHEN** a simulation run is converted into learning evidence
- **THEN** learning facts SHALL reference or summarize the trace instead of embedding high-frequency samples directly

### Requirement: EvaluationSpec v1 maps scene and Arena evaluation semantics
The system SHALL define `EvaluationSpec v1` references that bind each scene or Arena path to preview metrics, official metrics, hard constraints, visibility policy, and model relation metadata.

#### Scenario: Arena object is a simplified model
- **WHEN** an Arena black-box object is not the same model as the corresponding 3D simulation scene
- **THEN** the mapping SHALL record `modelRelation` as `simplified` or `surrogate`, state the teaching semantics, and identify evaluation claims that must not be mixed with the high-fidelity scene

#### Scenario: Official evaluation is configured
- **WHEN** an official evaluation protocol is attached to a scene or Arena task
- **THEN** the protocol SHALL state its metric ids, hard constraints, visibility boundary, and whether preview metrics are allowed to be shown to students

### Requirement: Existing runtime rules remain authoritative
The system SHALL keep Rust/WASM model ownership and fixed-step `SimulationClock` execution as the simulation runtime baseline.

#### Scenario: Protocol is added
- **WHEN** `SceneSpec v1` and `SimulationTrace v1` are introduced
- **THEN** the system SHALL NOT reintroduce front-end physics steppers, variable-delta model progression, or page-local numerical integrators

