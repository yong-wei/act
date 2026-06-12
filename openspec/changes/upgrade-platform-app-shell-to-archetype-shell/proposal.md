## Why

The existing `src/components/platform/app-shell.tsx` already contains role navigation, breadcrumbs, title/actions, user menu, theme, and sidebar support. The gap is that the shell is not yet the runtime owner of canonical archetype variants, workspace zones, evidence rail, support drawer, and floating dock behavior.

After the route ledger converges, the next step is to upgrade the existing AppShell rather than creating another shell family.

## What Changes

- Extend the current AppShell contract to consume route-ledger archetype metadata.
- Add canonical archetype variants for public entry, learning atlas, mission workspace, knowledge/data map, operations console, and report ledger.
- Add route-derived breadcrumbs, return targets, action slots, workspace zones, evidence rail, support drawer, and shared floating dock ownership.
- Preserve feature ownership boundaries: AppShell receives DTOs and slot props, but does not import Arena, course, simulation, adaptive, teacher, admin, or data-governance orchestration.

## Capabilities

### Modified Capabilities

- `platform-design-system-and-shell`
- `commercial-workspace-surface-system`

## Impact

- Depends on `converge-route-ledger-to-canonical-archetypes`.
- Enables the mission, learner/knowledge/data, and operations/report migration changes.
- Does not migrate all page families in this change.
