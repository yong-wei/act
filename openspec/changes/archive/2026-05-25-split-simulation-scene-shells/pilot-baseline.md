# Cruise Pilot Baseline

## Route And Launch Context

- Route: `/simulations/cruise`
- Server page: `src/app/simulations/cruise/page.tsx`
- Client scene: `src/resources/simulations/simulations/cruise-simulation.tsx`
- The route keeps the standalone simulation surface and can also show the Arena black-box submission panel when `arenaTask` resolves to the cruise-roll black-box identification task.
- Search params currently used by the scene: `role`, `step`, and `embed`.
- The route-level dynamic import and loading message are part of the existing visible behavior.

## Controls

- Run controls: start, pause/continue, reset.
- Runtime environment: virtual simulation observation toggle, sea state level, relative wave direction.
- Controller mode: `manual`, `p`, `pd`, `pid`.
- Manual mode exposes manual rudder angle.
- Course mode exposes PID gains with mode-specific editability.
- Stabilization controls: fin stabilizer toggle and notch filter toggle.
- Camera controls: camera mode switcher, grid toggle, and speed scaling up to `8x`.

## Visual Behavior

- The scene renders the same Three.js canvas with maritime environment, sea/grid, GLB cruise model, desired route, actual trajectory, heading arrows, orbit controls, and unified camera following.
- Expected route behavior remains: straight segment from `(-3000, 0)` followed by a right turn to `30deg`.
- The model remains scaled from `/assets/luxury-liner.glb` against `CRUISE_ADORA_PARAMS.LENGTH`.
- Existing UI docks remain left status monitoring and right control/evaluation/AI panels.
- The top bar remains hidden when `embed=1`.

## Runtime And Comfort Telemetry

- The physics facade remains the browser virtual simulation runtime path:
  - `preloadVirtualSimulationRuntime()`
  - `isVirtualSimulationRuntimeReady()`
  - `createSimulationEngine(cruiseAdoraProfile)`
  - `SimulationClock` with fixed-step timing and `getSimulationDeltaFromMilliseconds()`
- The scene samples the engine state, comfort metrics, fin stabilizer metrics, and internal fin state.
- Current runtime-derived evaluation fields:
  - overshoot after the route turn
  - settling time after the route turn
  - peak lateral acceleration
  - comfort MSI, roll RMS, roll peak, VDV, and weighted acceleration
  - fin power and fin angles
- The shell split must preserve the above runtime calls and avoid introducing a TypeScript physics stepper.

## Cruise Scene vs Arena Cruise-Roll Object

The Cruise pilot scene and the Arena cruise-roll black-box object are related for teaching, but they are not the same evaluation model.

- Cruise scene: high-fidelity visual scene for course-facing comfort control, route following, sea-state disturbance, fin stabilization, notch filtering, and student exploration.
- Arena cruise-roll object: simplified black-box identification/control object used by Arena tasks and official hidden evaluation.
- Shared teaching meaning: both expose a cruise-roll control problem, making it reasonable for students to transfer controller intuition and evidence vocabulary.
- Boundary: Cruise scene telemetry, visible preview metrics, and comfort summaries must not be presented as Arena official hidden-evaluation metrics.
- Required summary metadata: pilot telemetry summaries should identify `sim/cruise` separately from `plant-cruise-roll-blackbox` and carry a model-relation note so downstream UI does not mix claims across fidelity boundaries.
