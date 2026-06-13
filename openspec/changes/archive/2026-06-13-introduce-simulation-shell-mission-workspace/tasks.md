## 1. Shared Shell

- [x] 1.1 Add a shared `SimulationShell` mission-workspace wrapper.
- [x] 1.2 Expose breadcrumbs, theme switch, personal-center action, return target, and simulation workspace markers.
- [x] 1.3 Preserve existing simulation runtime components and dynamic loader boundaries.

## 2. Route Migration

- [x] 2.1 Migrate heading-control representative pages such as Destroyer and LNG.
- [x] 2.2 Migrate DP/positioning representative pages such as Drilling and Dredger.
- [x] 2.3 Migrate Cruise while preserving Arena launch provenance and black-box submission panel behavior.
- [x] 2.4 Migrate remaining detail pages or register bounded exceptions.

## 3. Inventory And Verification

- [x] 3.1 Register simulation detail routes as mission-workspace primary routes.
- [x] 3.2 Update source and route inventory tests for SimulationShell adoption.
- [x] 3.3 Add route smoke coverage for shell markers and representative scene visibility.
- [x] 3.4 Run focused tests and `rtk openspec validate introduce-simulation-shell-mission-workspace --strict`.
