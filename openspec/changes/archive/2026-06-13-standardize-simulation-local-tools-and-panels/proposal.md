## Why

Simulation detail pages now share `SimulationShell`, but scene-local controls still lack a governed layout contract. Telemetry, control, hints, and bottom commands need a common structure so each simulation keeps its own runtime while avoiding panel overlap, mobile crowding, and inconsistent tool placement.

## What Changes

- Add a shared simulation-local workspace layer for side panels, hint strip, and bottom toolbar.
- Register representative local-tool templates for heading control, DP/positioning, comfort/frequency, and ice propulsion.
- Attach the templates to current simulation detail pages without changing simulation runtime loaders or numerical behavior.
- Add source and route smoke coverage for local panel, mobile secondary-control, and bottom-toolbar markers.

## Impact

- Affected routes: `/simulations/cruise`, `/simulations/lng`, `/simulations/destroyer`, `/simulations/drilling`, `/simulations/container`, `/simulations/icebreaker`, `/simulations/dredger`.
- Affected specs: `commercial-workspace-surface-system`, `simulation-scene-shell-architecture`.
- No Rust/WASM, controller, telemetry persistence, or Arena scoring code changes.
