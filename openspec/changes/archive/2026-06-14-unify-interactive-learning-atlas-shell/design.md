## Design Source

Authoritative source: `artifacts/product-design-audits/interactive-learning-2026-06-14/design-handoff.md`.

Reference images:

- `concepts/01-learning-atlas-course-catalog.png`
- `concepts/revised/01-course-catalog-theory-practice.png`

## Design Decisions

- Treat the atlas pages as learning workspaces, not marketing pages or isolated cards.
- Use `AppShell` as the only global shell; no route-local global nav.
- Keep the left navigation collapsed by default and rely on persisted platform preference.
- Use a fluid outer workspace with bounded text or list regions only where readability requires it.
- Keep cross-domain exploration internals out of scope while making their entry/return path consistent.

## Visual QA Gate

This change is complete only when design QA compares the implemented atlas pages against the handoff and both reference images. The QA report must include source visual paths, implementation screenshots, matching viewport/theme/state, findings, fixes, and `final result: passed`.

Blocking mismatches include fixed full-page centered width, missing breadcrumb, duplicated global navigation, missing Konling dock, course type labels outside `理论课`/`实践课`, or failure to verify light/dark and mobile states.

## Dependency And Issue Registration

- Blocked by external change: `persist-app-shell-navigation-preference`.
- Must be registered under series `interactive-learning-ui-redesign`.
- Its issue must use a native blocked-by relationship to the AppShell persistence issue while that issue remains open.
- This change unlocks `migrate-interactive-course-entry-shell`.
