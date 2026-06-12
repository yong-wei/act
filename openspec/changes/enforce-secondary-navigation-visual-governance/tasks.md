## 1. Route Matrix and Governance Inputs

- [x] 1.1 Add or update the representative secondary route matrix for Arena, Control Workbench, Interactive Learning, course catalog, Interactive Learning first-hop destinations, adaptive practice, knowledge graph, and data center role states.
- [x] 1.2 Record shell type, route archetype, role scope, navigation layers, collapse behavior, local tools, theme support, mobile behavior, and owning migration change for each route.
- [x] 1.3 Encode upstream dependencies on shell collapse, student secondary route migration, knowledge graph migration, and data-center role restriction before enabling full blocking mode.
- [x] 1.4 Define narrow temporary exceptions for routes that cannot be fully migrated in the same series.

## 2. Automated Governance Checks

- [x] 2.1 Add a gate that rejects non-home primary routes with unregistered page-local topbars, page-local sidebars, or missing shell metadata after migration.
- [x] 2.2 Add collapse-state checks for actual rail width, content expansion, accessible labels, active route state, and absence of duplicated visible labels.
- [x] 2.3 Add checks proving Interactive Learning first-hop destinations do not retain legacy `UnifiedTopBar` after migration unless a narrow active exception is registered.
- [x] 2.4 Add role checks proving student navigation and student route evidence do not include `/data-center`.
- [x] 2.5 Add knowledge graph checks proving chapter directory, filters, legend, and node resource panels are local tools rather than platform navigation.
- [x] 2.6 Add data-center checks covering teacher and administrator states.

## 3. Visual and DOM Evidence

- [x] 3.1 Generate or require evidence manifests for desktop expanded, desktop collapsed, mobile drawer, light theme, and dark theme where supported.
- [x] 3.2 Ensure evidence records route, role, viewport, theme, shell state, expected entries, forbidden entries, and pass/fail result.
- [x] 3.3 Keep advisory mode for active migration exceptions and blocking mode for migrated routes.

## 4. Verification

- [x] 4.1 Add tests for route matrix completeness and exception expiry metadata.
- [x] 4.2 Add tests for forbidden student data-center entry coverage.
- [x] 4.3 Add tests proving dependency state controls advisory versus blocking enforcement.
- [x] 4.4 Run commercial UI governance checks in both advisory and blocking contexts where available.
- [x] 4.5 Run `rtk openspec validate enforce-secondary-navigation-visual-governance --strict`.
