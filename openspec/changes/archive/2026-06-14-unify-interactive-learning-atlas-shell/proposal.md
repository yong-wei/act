## Why

The interactive learning landing page, course catalog, chapter component list, and cross-domain exploration list have partially entered `AppShell`, but their layout still behaves like centered card pages. The accepted Product Design handoff requires these pages to become a fluid learning atlas with consistent breadcrumbs, collapsed navigation, unified Konling dock, and design-qa evidence against the accepted concept images.

## What Changes

- Convert `/interactive-learning`, `/interactive-learning/courses`, `/interactive-learning/chapter-components`, and `/interactive-learning/cross-domain-exploration` into a coherent interactive learning atlas surface.
- Preserve shared `AppShell`, default collapsed navigation, persisted navigation preference, top breadcrumbs, platform theme/user controls, and right-bottom Konling dock.
- Replace full-page fixed-width centered containers with fluid workspace layout while keeping readable inner regions where needed.
- Limit course type labels to `理论课` and `实践课`; runtime timing/status must come from runtime records.
- Require per-change `design-qa` against `design-handoff.md`, `concepts/01-learning-atlas-course-catalog.png`, and `concepts/revised/01-course-catalog-theory-practice.png`.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `platform-design-system-and-shell`: define the interactive learning atlas as an AppShell route family.
- `platform-role-navigation`: require multi-level interactive learning breadcrumbs and return continuity.

## Impact

- Affects interactive learning landing, course catalog, chapter component list, and cross-domain exploration list.
- Does not redesign Control Odyssey or Ten Drops game internals; only their list entry shell and route continuity are in scope.
- Depends on `persist-app-shell-navigation-preference` for default collapsed navigation, cross-page persistence, and shell governance evidence.
- Unlocks `migrate-interactive-course-entry-shell` after atlas shell and route hierarchy are accepted.
