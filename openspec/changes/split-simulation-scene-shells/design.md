## Context

The existing simulation scene pages are valuable but heavy. The correct path is not a physics rewrite. The better path is to isolate stable UI/runtime boundaries so scene migrations become repeatable and telemetry can be governed.

## Goals

- Split the Cruise pilot scene into reusable scene boundaries.
- Keep physics and visual behavior stable.
- Connect telemetry output to the protocol defined by the upstream change.
- Create a migration pattern for the remaining scenes.

## Non-Goals

- No all-scene rewrite in one change.
- No replacement of Rust/WASM runtime or model facade.
- No Arena official evaluation change.
- No student-facing copy rewrite unless necessary for the selected pilot.

## Design

The pilot scene should use four boundaries:

- `SceneShell`: route-level layout, launch context, loading/error states, scene lifecycle.
- `ControllerPanel`: controls, presets, controller parameters, user commands.
- `VisualizationLayer`: Three.js/canvas scene and visual-only effects.
- `TelemetryBridge`: normalized state sampling, summaries, completion events, trace references.

The pilot should keep the existing route path and continue to call the same runtime facade. The split should make telemetry explicit without changing physical model behavior.

Cruise is the pilot because it has rich comfort metrics, complete visual treatment, local rendering-layer duplication, and conceptual overlap with the Arena cruise-roll black-box object. The pilot must explicitly preserve the distinction between the high-fidelity Cruise scene and the simplified Arena roll object.

## Risks

- UI behavior can regress if state ownership changes too broadly. Keep the pilot narrow and snapshot existing behavior first.
- The boundary can become generic too early. Extract only interfaces needed by the pilot and documented downstream migration.

## Verification

- Component/unit tests for telemetry summary construction where feasible.
- Browser smoke check for the pilot route.
- Existing lint/build/test scope according to touched files.
- Gate with `rtk proxy openspec validate split-simulation-scene-shells --strict`.
