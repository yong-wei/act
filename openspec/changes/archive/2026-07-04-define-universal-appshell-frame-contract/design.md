## Investigation

- `src/components/platform/app-shell.tsx` already renders breadcrumbs, `ThemeSwitcher`, and `userMenu`, but pages can still pass arbitrary `actions` before the theme switch.
- `src/lib/platform-role-navigation.ts` currently defaults non-global routes to fixed desktop navigation; `/profile` is registered as a `report-ledger` route and therefore does not inherit the collapsible primary module rail.
- A route scan found 207 `page.tsx` files. Many teacher and admin pages are covered by layout-level shells, but many product, classroom, course runtime, AI, playlist, and legacy student pages still have no directly provable AppShell-compatible frame.
- Several primary modules use AppShell or wrappers, but their header action semantics diverge: learning path exposes path management in the top-right area, simulations and Arena expose Personal Center in different order, and Control Workbench retains a route-local return action in the shell action area.

## Contract

The universal frame should be the only non-home product route shell. Product pages can provide local toolbars inside their content or workspace slots, but they cannot redefine first-level navigation or top-right account/theme placement.

The shell contract should include:

- Desktop left navigation: collapsible primary rail, canonical sequence, stable active state, and profile route inclusion.
- Top bar: shared header component, breadcrumbs, title/subtitle, and fixed top-right order.
- Top-right actions: every non-exempt non-home route renders exactly the shell-owned theme switch first and role-aware Personal Center second. Konling, assistant docks, returns, path management, exports, settings, filters, and local management commands do not enter this pair.
- Breadcrumbs: every non-home route needs either route metadata or explicit breadcrumb props.
- Governed wrapper registry: AppShell-compatible wrappers must be registered by name and pass the same DOM contract as direct AppShell routes before their routes count as covered.
- Exceptions: every route without shell coverage must be named with reason, owner, violated rule, and removal condition.

This change owns the shell contract layer. Follow-up implementation must also update route-ledger/navigation metadata and any commercial UI governance specs or tests that consume the shell contract.

## Validation Strategy

- Static route scanner over `src/app/**/page.tsx` plus ancestor layouts.
- Source tests for AppShell header action order.
- Route metadata tests for canonical nav sequence and collapsible navigation.
- An exception inventory test that fails on unclassified routes.
- Wrapper registry tests covering every approved AppShell-compatible wrapper.
