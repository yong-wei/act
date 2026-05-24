## 1. Protocol Definition

- [ ] 1.1 Add `SceneSpec v1`, `EvaluationSpec v1`, and `SimulationTrace v1` type contracts in the simulation resource boundary.
- [ ] 1.2 Document required, optional, and derived fields for scene, model, disturbance, evaluation, assets, telemetry, replay, and governance metadata in `docs/Simulation_Guidelines.md` or a linked protocol document.
- [ ] 1.3 Preserve the fixed-step Rust/WASM constraints from `docs/Simulation_Guidelines.md`.

## 2. Inventory

- [ ] 2.1 Map the seven `/simulations/*` entries to `SceneSpec v1` in a committed inventory artifact.
- [ ] 2.2 Map Arena public experiment, virtual preview, and official evaluation to `SimulationTrace v1` and `EvaluationSpec v1`.
- [ ] 2.3 Record model relation gaps, including simplified or surrogate Arena objects, in the inventory artifact.

## 3. Validation

- [ ] 3.1 Run `rtk proxy openspec validate standardize-simulation-scene-and-trace-protocol --strict`.
- [ ] 3.2 Add targeted type or contract tests if implementation introduces executable TypeScript types.
