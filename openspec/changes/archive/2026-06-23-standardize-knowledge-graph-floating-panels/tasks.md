## 1. Workspace Layout

- [x] 1.1 Refactor `/knowledge` graph workspace so the canvas area is viewport-bound under AppShell and does not create page-level scroll.
- [x] 1.2 Define stable workspace inset tokens or layout constants for local graph panels and right-edge inspector placement.
- [x] 1.3 Verify default graph canvas dimensions and page scroll metrics before and after local tool or inspector state changes.

## 2. Local Tool Panels

- [x] 2.1 Introduce a shared local graph tool shell for directory, filter, legend, and view controls.
- [x] 2.2 Move relation filter content into the shared shell and remove its separate absolute panel branch.
- [x] 2.3 Align width, right edge, close affordance, scroll containment, keyboard handling, `aria-controls`, focus return, and visual treatment across all four local tools.
- [x] 2.4 Ensure local tool panel edge gaps remain fixed when the canvas or viewport becomes wider.

## 3. Floating Inspector And Shared Tools

- [x] 3.1 Convert the selected-node detail panel from a desktop layout rail to a right-edge floating inspector.
- [x] 3.2 Ensure inspector open/close does not resize or recenter the graph canvas and does not move selected-node state.
- [x] 3.3 Keep the collapsed Konling floating button stable when local graph tools or the inspector open.
- [x] 3.4 Keep right-bottom workspace tools reachable and non-overlapping with local graph panels and inspector.

## 4. Validation And Audit

- [x] 4.1 Add or update automated checks for panel geometry, fixed edge inset behavior, canvas stability, page scroll suppression, inspector floating behavior, and Konling dock stability.
- [x] 4.2 Capture visual evidence for default state, directory, filter, legend, view controls, selected-node inspector, combined stress state, light/dark theme, and mobile.
- [x] 4.3 Run an independent visual review subagent using screenshots, DOM metrics, changed files, and this OpenSpec change; resolve every BLOCK finding.
- [x] 4.4 Run `rtk openspec validate standardize-knowledge-graph-floating-panels --strict`.
- [x] 4.5 Run the relevant commercial UI governance and Playwright checks for `/knowledge`, or document any pre-existing unrelated failures with evidence.
