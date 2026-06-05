## Why

The repository already defines central navigation contracts, but real pages still use independent shells and competing route lists. A premium platform cannot keep homepage menus, `UnifiedTopBar`, `ArenaPageShell`, teacher headers, admin tabs, breadcrumbs, and floating controls as separate navigation languages.

## What Changes

- Rebuild the navigation frame around product orientation, role cockpit, contextual route trace, and local tool navigation.
- Make route inventory the source of truth for shell, role scope, mobile behavior, and floating dock behavior.
- Unify mobile navigation so hidden sidebars do not remove reachability.
- Define one dock information architecture for Konling, management, and settings controls.
- Allow the homepage to use a branded public-entry navigation variant while requiring other primary routes to converge on AppShell or approved workspace shell navigation.
- Register disposition for `UnifiedTopBar`, `ArenaPageShell`, `TeacherLayout`, `AdminConsoleHeader`, page floating controls, and the global AI button before they can remain during migration.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `platform-role-navigation`: strengthens navigation layers, role journeys, mobile behavior, and route inventory requirements.
- `platform-design-system-and-shell`: strengthens shell/frame and dock ownership requirements.

## Impact

- Affects `src/lib/platform-role-navigation.ts`, `src/components/platform/app-shell.tsx`, `src/components/shared/unified-top-bar.tsx`, `src/features/arena/arena-page-shell.tsx`, teacher/admin shells, `PageFloatingControls`, `GlobalAIFloatingButton`, and related navigation tests.
