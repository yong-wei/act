## Why

Mission workspaces are the most visible place where inconsistent shells hurt the product. Arena, Arena challenge detail, Control Workbench, simulations, and interactive runtime all need dense task UI, contextual return paths, evidence, support, and local tools. The current Arena-local shell and Control Workbench zone contracts are strong candidates, but they are not yet unified through the platform AppShell.

## What Changes

- Migrate representative mission routes to the upgraded AppShell mission-workspace archetype.
- Use the Arena -> Challenge -> Control Workbench chain as the primary acceptance path.
- Preserve official Arena evaluation boundaries, Control Workbench object/method state, and runtime lesson manifest truth.
- Retire or adapt local mission shells only when route behavior, return targets, dock behavior, and visual evidence remain intact.

## Capabilities

### Modified Capabilities

- `commercial-workspace-surface-system`
- `simulation-arena-workbench-experience-ui`

## Impact

- Depends on `upgrade-platform-app-shell-to-archetype-shell`.
- Does not migrate learner record, teacher, admin, or report surfaces.
- Must avoid introducing new React Doctor error-level findings in migrated workspaces.
