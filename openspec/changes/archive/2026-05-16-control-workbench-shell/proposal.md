## Why

Arena already has a shared task, object, evaluation, submission, and leaderboard layer, but the design surface is still split across several unrelated pages. A unified control workbench shell gives every challenge a consistent entry and context model without forcing all numerical methods into one component.

## What Changes

- Add a new `/interactive-learning/control-workbench` route as the common workbench entry.
- Introduce a `WorkbenchSessionContext` that wraps Arena task context, route parameters, challenge/free-explore mode, target model, working model, allowed methods, default layout, and submission policy.
- Render a common task context bar and shell layout that can host later layout presets.
- Fail closed for invalid `arenaTask` values instead of falling back to default cruise or demo models.
- Keep existing workbench routes working while the unified shell is introduced.

## Capabilities

### New Capabilities
- `control-workbench-session-context`: Defines the unified workbench route, session context, challenge/free-explore mode behavior, and fail-closed context resolution.

### Modified Capabilities

## Impact

- New files under `src/app/interactive-learning/control-workbench/` and `src/features/control-workbench/`.
- Reuses `src/features/arena/workbench/context.ts`, `src/features/arena/workbench/types.ts`, and existing Arena task seed data.
- No API or database schema changes.
- Existing `/interactive-learning/multi-representation-linkage`, `/simulations/cruise`, `/interactive-learning/lesson-05`, and Odyssey routes remain available.
