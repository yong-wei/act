## Why

The current UI unification work still allows important secondary routes to drift: some pages use AppShell, some keep page-local topbars, some retain local sidebars, and some collapse states only change a marker without changing layout. The result is a platform that appears unified in isolated screenshots but loses consistency across real student, teacher, administrator, knowledge, and data workflows.

## What Changes

- Add governance checks for representative secondary route shell conformance.
- Require non-home primary routes to use AppShell or an approved workspace shell, with temporary exceptions tied to a removal condition.
- Verify collapsed navigation by layout behavior, not only by data attributes.
- Verify student navigation excludes data center.
- Verify knowledge graph local panels are treated as tools rather than platform navigation.
- Require a route evidence matrix covering Arena, Control Workbench, Interactive Learning, course catalog, first-hop Interactive Learning destinations, adaptive practice, knowledge graph, and data center role states.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `commercial-ui-governance-gates`: expands commercial UI governance to detect secondary navigation drift and incomplete collapse behavior.
- `platform-role-navigation`: makes route inventory and role navigation enforceable across secondary pages, including data-center exclusion for students.

## Impact

- Affects UI governance scripts, route inventory fixtures, screenshot or DOM evidence manifests, and review checklist expectations.
- Depends on `fix-app-shell-collapsed-navigation-contract`, `migrate-student-secondary-routes-to-unified-shell`, `migrate-knowledge-map-to-unified-shell-panels`, and `restrict-data-center-to-operations-roles` for blocking-mode rollout.
