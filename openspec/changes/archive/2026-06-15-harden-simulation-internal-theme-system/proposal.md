## Why

The 2026-06-15 full simulation audit shows that `/simulations/*` pages now share platform chrome but their simulation-internal panels, HUDs, and 3D scene parameters still behave like independent light-theme demos. Dark mode therefore reads as a dark AppShell embedding pale scene cards instead of a coherent commercial simulation workspace.

## What Changes

- Introduce a simulation-internal theme contract for resource panels, metric tiles, HUD labels, hint strips, camera controls, and local tool surfaces.
- Define real light and dark scene parameters for sky, water, grid, fog, labels, surface glow, and HUD contrast instead of only changing outer shell colors.
- Replace long-term hard-coded `bg-white`, `bg-slate-*`, `text-white`, and `text-slate-*` simulation resource styling with approved simulation theme tokens or component primitives.
- Require dark/light visual evidence for every simulation resource family touched by this change.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `simulation-scene-shell-architecture`: add resource-internal theme and scene-parameter requirements for simulation detail pages.
- `commercial-ui-governance-gates`: add governance checks that reject simulation-internal theme drift after migration.

## Impact

- Affects `src/resources/simulations/components/simulation-ui.tsx`, `src/resources/simulations/simulations/*-simulation.tsx`, scene parameter helpers, shared simulation local-tool primitives, and visual QA artifacts.
- Does not change physics models, controller algorithms, Arena scoring, or simulation evidence semantics.
