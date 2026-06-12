## Context

The mission-workspace migration should prove that the unified shell can carry real dense workflows, not just entry pages. The minimum convincing journey is Arena hall to challenge detail to Control Workbench.

## Goals / Non-Goals

**Goals:**

- Migrate Arena hall, Arena challenge detail, Control Workbench, and representative simulation/runtime routes to the mission-workspace archetype.
- Preserve contextual return targets from Arena challenge or publication into Control Workbench.
- Keep instrument panels visible in the first viewport across desktop and 320px mobile.
- Capture visual evidence for expanded, collapsed, and mobile drawer shell states in light and dark themes.

**Non-Goals:**

- Rewriting Arena scoring, official evaluation, or Control Workbench numerical behavior.
- Changing interactive lesson manifest schemas.
- Migrating teacher or report routes.

## Decisions

### Decision 1: The first demo chain is Arena to Control Workbench

This chain exercises route context, return target, dense instrumentation, evidence, and support drawer behavior. It is a better migration proof than a static dashboard.

### Decision 2: Domain truth remains feature-owned

The shell may display challenge state, object selection, method availability, or evidence status, but Arena, simulation, and lesson-runtime domains remain responsible for computing those states.

### Decision 3: Mobile mission UI uses drawers and sheets

Mission routes must not squeeze full desktop panels into 320px. Secondary controls move into drawers, sheets, tabs, or command surfaces while the main visualization remains reachable.

## Validation

- Browser or Playwright evidence covers Arena hall, challenge detail, and Control Workbench in desktop and 320px mobile.
- Tests verify contextual return targets and route-ledger shell metadata.
- Existing Arena/workbench smoke tests continue to pass.
- `rtk openspec validate migrate-mission-workspaces-to-unified-shell --strict` passes.
