## Why

Interactive Learning, the course catalog, and adaptive practice currently use different shell and navigation patterns. Some still use `UnifiedTopBar`, while adaptive practice uses AppShell but keeps a fixed two-item sidebar that does not match the student journey navigation used by Arena and Control Workbench.

## What Changes

- Migrate `/interactive-learning`, `/interactive-learning/courses`, and their first-hop student destinations `/interactive-learning/chapter-components` and `/interactive-learning/cross-domain-exploration` from page-local topbar and local color systems into the unified AppShell learning-atlas route frame.
- Align `/assessment/adaptive-practice` with the same student secondary navigation semantics used by the core student journey.
- Preserve current learning intent, first-viewport task visibility, course launch actions, unauthenticated/fallback states, and evidence review paths.
- Keep course runtime pages and lesson-specific content outside this change, but do not allow first-hop Interactive Learning entry destinations to remain on the legacy shell.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `commercial-student-entry-surfaces`: requires student secondary learning and practice routes to share the unified shell and journey navigation.
- `platform-role-navigation`: clarifies which student route families appear in secondary page navigation and prevents page-local topbars from becoming primary navigation.

## Impact

- Affects `/interactive-learning`, `/interactive-learning/courses`, `/interactive-learning/chapter-components`, `/interactive-learning/cross-domain-exploration`, `/assessment/adaptive-practice`, central role navigation, and representative visual evidence.
- Depends on `fix-app-shell-collapsed-navigation-contract` for the shared collapsible navigation behavior.
