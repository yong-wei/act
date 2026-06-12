## 1. Route Shell Migration

- [ ] 1.1 Render `/knowledge` through the unified knowledge-data-map AppShell for public and authenticated states.
- [ ] 1.2 Resolve role-aware navigation and account/cockpit actions from central route inventory without page-local shell fallbacks.
- [ ] 1.3 Preserve graph loading, 2D/3D switching, node selection, and resource panel behavior.

## 2. Local Panel Refactor

- [ ] 2.1 Convert `KnowledgeSidebar` into a graph-local chapter directory panel with platform tokens and local panel semantics.
- [ ] 2.2 Ensure relation filters, legend, and resource panel render as workspace local tools, evidence/support panels, or mobile drawers.
- [ ] 2.3 Remove hard-coded shell palette and fixed platform-looking navigation behavior from graph controls.

## 3. Verification

- [ ] 3.1 Add route and component tests proving `/knowledge` uses the central shell and local panels do not register as platform navigation.
- [ ] 3.2 Capture desktop and mobile visual evidence for public and authenticated role states.
- [ ] 3.3 Run knowledge graph UI tests and commercial UI governance checks for route-local palette and mobile sidebars.
- [ ] 3.4 Run `rtk openspec validate migrate-knowledge-map-to-unified-shell-panels --strict`.
