## Context

The platform currently has multiple role entrances and several module-level headers. The UI report recommends one brand, three roles, six core student modules, and a unified data/governance surface. This change turns that into route and navigation contracts without implementing downstream product screens.

## Goals / Non-Goals

Goals:

- Define stable navigation groups for student, teacher, admin, and unauthenticated users.
- Keep repeated navigation order stable across homepage, dashboard, module shell, and mobile drawer.
- Define concrete homepage, login, student dashboard, and profile migration behavior instead of only defining navigation data.
- Reserve feature-flagged destinations for active OpenSpec changes that are not implemented yet.

Non-goals:

- No full redesign of individual module pages.
- No changes to authentication or authorization semantics beyond route display and redirect compatibility.
- No removal of old route aliases.

## Decisions

### Treat entrypoints as product architecture

The homepage should lead to role entry and core capabilities, not act as a decorative landing page. Student navigation must make Arena, Workbench, simulations, knowledge/resources, adaptive learning, and profile visible as stable first-class entries.

### Make entry migration directly testable

The entrypoint change owns the visible route migration for `/`, `/login`, `/dashboard`, and `/profile`: shared auth form reuse, six-entry student matrix, cockpit action consistency, mobile drawer access at 320px, and route smoke behavior. Downstream module changes own the content inside each destination.

### Keep future entries explicit

Entries for ResourceNode management, adaptive path map/timeline/evidence, Konling interventions, governance center, and experiment operations remain feature-flagged until their backing changes are implemented.

## Risks

- Exposing future entries too early can create dead navigation. Feature flags and disabled states must distinguish unavailable routes from hidden modules.
- Overloading the top navigation can hurt mobile usability. The shell must use responsive grouping and a mobile drawer.

## Verification

- Source tests for role navigation configuration and stable ordering.
- Route smoke tests for homepage to cockpit to core-module paths.
- Mobile width smoke check for drawer access to all visible entries.
