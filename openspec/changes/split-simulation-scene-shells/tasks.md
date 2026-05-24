## 1. Pilot Baseline

- [ ] 1.1 Use Cruise as the pilot scene and record the existing route, controls, visual behavior, and comfort telemetry baseline.
- [ ] 1.2 Document the Cruise scene and Arena cruise-roll model relation before editing.

## 2. Shell Decomposition

- [ ] 2.1 Introduce `SceneShell`, `ControllerPanel`, `VisualizationLayer`, and `TelemetryBridge` boundaries for the pilot.
- [ ] 2.2 Preserve existing runtime facade calls and visual behavior.
- [ ] 2.3 Emit protocol-compatible telemetry summaries from the pilot.

## 3. Validation

- [ ] 3.1 Run focused route/component tests or browser smoke checks for the Cruise pilot.
- [ ] 3.2 Run `rtk proxy openspec validate split-simulation-scene-shells --strict`.
