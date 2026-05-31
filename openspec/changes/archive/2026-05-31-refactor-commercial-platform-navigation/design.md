## Context

Existing specs already centralize role navigation and define `AppShell`, but the current UI still renders multiple page-local shells. The commercial redesign should clarify navigation ownership before pages are migrated.

## Navigation Model

Layer 1: global product navigation

- Public/student product entries: Interactive Learning, Arena, Control Workbench, Adaptive Learning, Knowledge Resources, Simulations.
- The global layer is visible in public and student product surfaces, but it should not crowd dense workspaces.

Layer 2: role cockpit navigation

- Student cockpit, teacher workspace, admin console, audit/governance views.
- Role cockpit navigation owns operational tasks, user menu, theme, and account/profile access.
- Authentication surfaces preserve the intended callback route while presenting role-aware account and cockpit destinations after sign-in.

Layer 3: contextual workspace navigation

- Arena: challenge hall, training map, submissions, leaderboard, publications when role allows.
- Control Workbench: context strip, object/method boundary, evidence panels, official evaluation state, return target.
- Interactive Learning: course chain, cross-domain exploration, component library, course runtime.

## Shell Strategy

`AppShell` remains the common infrastructure, but commercial pages may introduce specialized workspace shells derived from the same brand tokens. Legacy shells can be retired when they duplicate global navigation or conflict with contextual navigation.

## Risks

- Too much global navigation inside dense tools can reduce task focus. Workspace pages should show a compact global affordance and stronger contextual controls.
- If profile and cockpit actions are both primary actions, navigation will remain ambiguous. Profile should be account-level; cockpit is role-level.

## Verification

- Source tests for central navigation data.
- Browser checks for desktop and 320px mobile navigation availability.
- Route smoke tests for global entries, role cockpit actions, authentication callbacks, breadcrumbs, and return targets.
