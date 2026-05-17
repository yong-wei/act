## Why

The current cross-domain exploration entry still presents the legacy multi-representation workbench, while Arena already routes supported tasks into the unified control workbench. This leaves free exploration on a different surface and prevents object-driven panel configuration from sharing the same foundation.

## What Changes

- Rename the user-facing workbench surface from legacy multi-representation wording to “综合仿真工作台”.
- Route the cross-domain free-explore entry to `/interactive-learning/control-workbench?mode=explore&preset=classic-four-view`.
- Make free-explore sessions provide a selected object and working model so the classic four-view preset can render from configuration instead of requiring an Arena task.
- Keep Arena task routing on the unified workbench unchanged.
- Preserve the legacy `/interactive-learning/multi-representation-linkage` direct route as a compatibility surface.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `control-workbench-session-context`: free-explore sessions must expose selected-object and working-model context.
- `control-workbench-classic-preset`: the classic preset must render for configured free-explore sessions, not only challenge sessions.
- `arena-control-workbench-routing`: cross-domain free-explore entry language and target must prefer the comprehensive simulation workbench while Arena routing remains unchanged.

## Impact

- Affected frontend routes and shell code:
  - `src/app/interactive-learning/cross-domain-exploration/page.tsx`
  - `src/app/interactive-learning/control-workbench/page.tsx`
  - `src/features/control-workbench/session-resolver.ts`
  - `src/features/control-workbench/shell/control-workbench-shell.tsx`
  - `src/features/control-workbench/presets/classic-four-view-preset.tsx`
- Affected tests should cover the cross-domain entry route, free-explore session resolution, classic preset rendering, and legacy route compatibility.
