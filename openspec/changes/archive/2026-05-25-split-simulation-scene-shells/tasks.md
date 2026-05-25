## 1. Pilot Baseline

- [x] 1.1 Use Cruise as the pilot scene and record the existing route, controls, visual behavior, and comfort telemetry baseline.
- [x] 1.2 Document the Cruise scene and Arena cruise-roll model relation before editing.

## 2. Shell Decomposition

- [x] 2.1 Introduce `SceneShell`, `ControllerPanel`, `VisualizationLayer`, and `TelemetryBridge` boundaries for the pilot.
- [x] 2.2 Preserve existing runtime facade calls and visual behavior.
- [x] 2.3 Emit protocol-compatible telemetry summaries from the pilot.

## 3. Validation

- [x] 3.1 Run focused route/component tests or browser smoke checks for the Cruise pilot.
- [x] 3.2 Run `rtk proxy openspec validate split-simulation-scene-shells --strict`.
