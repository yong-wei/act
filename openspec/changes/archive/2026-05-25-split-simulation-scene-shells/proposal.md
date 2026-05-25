## Why

Large simulation pages currently mix scene rendering, controls, telemetry, course logic, and runtime wiring. The report correctly recommends page restructuring without rewriting the physical kernel, because the kernel and scene semantics already carry real value.

## What Changes

- Introduce the boundary `SceneShell / ControllerPanel / VisualizationLayer / TelemetryBridge`.
- Pilot the split on Cruise because it has the richest comfort telemetry and the clearest Arena-model consistency gap.
- Preserve existing route behavior, visual behavior, and Rust/WASM physics calls.
- Make the pilot emit protocol-compatible telemetry summaries.

## Capabilities

### New Capabilities
- `simulation-scene-shell-architecture`: Defines scene shell decomposition and pilot migration expectations.

### Modified Capabilities
- None.

## Impact

- Affects one selected `src/app/simulations/*` route and associated `src/resources/simulations/**` modules.
- Depends on protocol, replay, and evidence-governance changes.
- Gate with `rtk proxy openspec validate split-simulation-scene-shells --strict`.
