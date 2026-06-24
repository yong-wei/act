## 1. Workspace Shells

- [x] 1.1 Define and implement the immersive simulation workspace frame.
- [x] 1.2 Define and implement the engineering analysis workspace frame.
- [x] 1.3 Map simulation, Control Workbench, Arena, and interactive runtime routes to the correct frame.

## 2. Navigation and Panels

- [x] 2.1 Preserve launch provenance and contextual return targets.
- [x] 2.2 Standardize context strip, command bar, instrument area, evidence rail, support drawer, and bottom tool controls.
- [x] 2.3 Confirm the floating action dock does not collide with scene controls or chart panels.

## 3. Verification

- [x] 3.1 Run `rtk openspec validate unify-immersive-task-workspaces --strict`.
- [x] 3.2 Run focused route and task-workspace tests.
- [x] 3.3 Capture light/dark browser screenshots for representative task workspaces.

Verification note: Playwright captured 20 route/theme/viewport artifacts under `artifacts/task-workspace-shell/20260604T171355Z/`, covering cruise simulation, Control Workbench, Arena challenge detail, unit 4-1 lesson entry, and unit 4-1 student runtime in light/dark desktop/mobile. Manifest summary: 20 screenshots, 0 non-200 responses, 0 missing archetype markers, 0 missing return targets, 0 title modules with root-level archetype markers, 0 excessive mobile right padding, 0 insufficient bottom safe-area padding, and 0 page errors. Console output includes pre-existing THREE deprecation warnings, Workbench ECharts graphic registration warnings, unauthenticated Arena 401 resource requests, and Next Image LCP warnings; they are recorded in the manifest and did not block route rendering or workspace marker verification.
