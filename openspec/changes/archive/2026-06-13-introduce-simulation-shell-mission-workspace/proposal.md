## Why

Simulation detail pages still use page-local `FeaturePageNav` wrappers while the rest of the student workspace family is moving to AppShell-derived mission workspaces. This leaves `/simulations/*` with a different navigation language and weak route trace, even though the actual simulation runtime should remain feature-owned.

## What Changes

- Introduce a shared `SimulationShell` mission-workspace wrapper for simulation detail routes.
- Migrate representative and existing simulation detail pages to the shared shell without changing runtime components.
- Register simulation detail routes in the primary route inventory with mission-workspace semantics and contextual return targets.
- Preserve Cruise Arena launch provenance, black-box submission panel behavior, and standalone deep links.

## What Does Not Change

- No Rust/WASM, physics, simulation clock, controller, telemetry protocol, or Arena official evaluation logic changes.
- No final Konling dock placement or dual-theme template work.
- No redesign of local simulation control panels beyond placing the existing scene under the shared route shell.

## Impact

- Affects `/simulations/*` detail page shells, route inventory metadata, and platform/UI governance tests.
- Keeps simulation runtime behavior owned by `src/resources/simulations/**`.
