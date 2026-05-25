## Why

The repository already has seven maritime simulation scenes, Arena preview/evaluation flows, Rust/WASM runtime boundaries, and data-governance ambitions, but these pieces do not share a formal scene or trace contract. Without a protocol, later replayability, evidence governance, Arena model registration, and course-resource integration will keep encoding incompatible assumptions.

## What Changes

- Introduce `SceneSpec v1` for simulation model, scene, disturbance, evaluation, asset, telemetry, replay, and governance metadata.
- Introduce `EvaluationSpec v1` references inside the scene protocol so preview, official evaluation, and course success criteria do not drift apart.
- Introduce `SimulationTrace v1` for run identity, sample cadence, trace layers, summary metrics, seed/version metadata, and replay checksum.
- Inventory current `/simulations/*` entries and Arena black-box preview/evaluation against the protocol.
- Preserve the existing Rust/WASM and `SimulationClock` rules from `docs/Simulation_Guidelines.md`.

## Capabilities

### New Capabilities
- `simulation-scene-trace-protocol`: Defines the shared `SceneSpec v1` and `SimulationTrace v1` contracts.

### Modified Capabilities
- None. This change creates the shared protocol capability; later changes modify evidence, Arena, and course-resource capabilities against this contract.

## Impact

- Affects future work in `src/resources/simulations/**`, `src/features/arena/**`, `src/lib/data-governance/**`, and course resource registration.
- Does not require immediate runtime behavior changes.
- Validation gate is change-level strict validation for this series; repository-wide `validate --all` currently includes pre-existing unrelated main-spec structure failures.
