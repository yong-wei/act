## Why

The full simulation audit found that `/simulations/cruise` no longer matches the command-deck geometry used by the other six simulations, and every simulation still carries resource-local chrome such as the in-scene "返回上一层" text and right-top simulation abbreviation. These elements duplicate AppShell navigation and weaken the immersive shell.

## What Changes

- Normalize all seven simulation detail routes to the accepted command-deck geometry from the handoff.
- Remove simulation-internal top-left "返回上一层" controls from the scene frame because AppShell breadcrumbs own upward navigation.
- Remove simulation-internal top-right abbreviations such as `LNG/OBE`; simulation identity belongs to route title, breadcrumb, and catalog metadata.
- Move left telemetry/status and right control/evaluation panels upward to the top of the simulation scene workspace while preserving collapse and restore controls.
- Bring `/simulations/cruise` back to scene-first geometry and move its extra context, evidence, and support content into appropriate collapsible or mission-context surfaces.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `simulation-scene-shell-architecture`: tighten command-deck composition, scene chrome removal, panel positioning, and cruise geometry requirements.
- `commercial-ui-governance-gates`: require visual checks that reject duplicate in-scene navigation, in-scene abbreviations, panel misplacement, and cruise geometry drift.

## Impact

- Affects `src/app/simulations/_components/simulation-shell.tsx`, `src/app/simulations/cruise/page.tsx`, local tool templates, all simulation detail resource components, and visual QA artifacts.
- Does not remove AppShell breadcrumbs, platform route identity, or mission-context content; it relocates duplicate or misplaced content into the unified shell model.
