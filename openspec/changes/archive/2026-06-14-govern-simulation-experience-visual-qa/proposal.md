## Why

The simulation redesign needs a final acceptance gate so implementation cannot stop at partial styling. Governance must prove route inventory coverage, shell conformance, dual-theme quality, mobile behavior, dock safety, and nonblank simulation scenes.

## What Changes

- Add simulation-specific visual QA matrix for catalog, `/virtual-lab`, representative simulation pages, Control Workbench regression, and mobile.
- Require structured evidence metadata for route, archetype, theme, viewport, navigation state, dock state, scene visibility, and result.
- Add checks for conflicting availability counts, duplicate assistant entries, local-control collisions, and student-facing model status leakage.
- Require React Doctor error-level and accessibility-related local checks for affected routes where feasible.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `commercial-ui-governance-gates`: define simulation route visual QA, route governance, and acceptance checks.

## Impact

- Affects visual evidence scripts/manifests, route inventory governance, commercial UI tests, and local review checklists.
- Does not create CI integration; checks remain local unless future quota policy changes.
