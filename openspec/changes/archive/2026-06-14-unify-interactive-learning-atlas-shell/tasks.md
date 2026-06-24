## 1. Atlas Shell

- [x] 1.1 Migrate the route family to the shared AppShell atlas contract.
- [x] 1.2 Ensure left navigation defaults to collapsed and respects persisted user preference.
- [x] 1.3 Add or verify breadcrumbs for landing, course catalog, chapter components, and cross-domain exploration.
- [x] 1.4 Replace full-page fixed-width containers with fluid workspace layout.

## 2. Course Catalog Semantics

- [x] 2.1 Restrict course type labels to `理论课` and `实践课`.
- [x] 2.2 Source course time/status from runtime metadata rather than invented display categories.
- [x] 2.3 Keep learning evidence and next actions visible without turning every item into a nested card.

## 3. Visual QA

- [x] 3.1 Capture implementation screenshots for desktop 1440px, mobile 320px, light theme, and dark theme.
- [x] 3.2 Save the QA report under this change's evidence directory and include source visual paths, implementation screenshot paths, viewport, theme, state, full-view comparison, focused comparison notes, and `final result`.
- [x] 3.3 Run Product Design `design-qa` against `design-handoff.md`, `concepts/01-learning-atlas-course-catalog.png`, and `concepts/revised/01-course-catalog-theory-practice.png`.
- [x] 3.4 Fix every P0/P1/P2 visual mismatch and re-run QA until `final result: passed`.
- [x] 3.5 Run `rtk openspec validate unify-interactive-learning-atlas-shell --strict`.

## 4. Issue Dependency Gate

- [x] 4.1 Confirm this issue is blocked by `persist-app-shell-navigation-preference` while that external change remains open.
- [x] 4.2 Confirm this issue is in series `interactive-learning-ui-redesign`.
