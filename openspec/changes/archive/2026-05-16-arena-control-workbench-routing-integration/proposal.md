## Why

Arena still routes tasks by `workspaceMode` into several legacy pages, while the long-term plan makes the comprehensive control workbench the default design, simulation, identification, preview, and submission entry. After the unified workbench branch and Arena backend upgrades land, Arena needs a focused integration change that moves task entry to the shared workbench without breaking Control Odyssey or old direct routes.

## What Changes

- Change Arena workspace routing so white-box, black-box, composite, and MPC tasks default to `/interactive-learning/control-workbench` with `arenaTask`, `publicationId`, and preset parameters.
- Keep Control Odyssey on its dedicated route because it has its own game loop, scoring, and Arena bridge.
- Update challenge detail and hall entry text to use the unified label `进入控制工作台`.
- Preserve old route compatibility for legacy direct links, especially `/interactive-learning/multi-representation-linkage`.
- Ensure `publicationId` and other routing parameters survive the new control-workbench link.
- Update tests so Arena task cards, challenge detail pages, and route helpers assert the new routing contract.

## Capabilities

### New Capabilities

- `arena-control-workbench-routing`: Arena task-to-workbench routing rules for the comprehensive control workbench integration.

### Modified Capabilities

- `arena-student-entry-experience`: Student-facing Arena entry pages use the unified control workbench label and default route while retaining read-only challenge detail behavior.

## Impact

- Depends on the unified control workbench branch exposing `/interactive-learning/control-workbench`.
- Depends on `control-workbench-contracts` already being merged.
- Should be applied after `arena-v3-plant-adapter-and-blackbox-official-evaluation` and `arena-v3-publication-feedback-analytics` unless the route switch is explicitly staged behind a compatibility flag.
- `src/features/arena/workspace-routing.ts`
- `src/features/arena/challenge-detail.tsx`
- `src/features/arena/arena-hall.tsx`
- Legacy direct-route compatibility tests
- Arena entry UI and routing tests
