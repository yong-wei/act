## 1. QA Matrix

- [x] 1.1 Define route/state matrix for generation main, Konling parameter panel, cold-start starter paths, path comparison, active path execution, node detail, skip warning, history/evidence record, and mobile views.
- [x] 1.2 Include light and dark themes, 1440px desktop, 320px mobile, AppShell collapsed default, expanded persisted state, breadcrumbs, account controls, and right-bottom Konling dock.
- [x] 1.3 Define structured evidence metadata for route, goal, theme, viewport, auth state, navigation state, dock state, page state, selected path, selected node, and result.

## 2. Handoff And Concept Alignment

- [x] 2.1 Cite `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/design-handoff.md` as design source of truth.
- [x] 2.2 Cite all four concept images and document which elements are adopted, merged, or rejected according to the handoff.
- [x] 2.3 Require implementation screenshots to visibly match the accepted layout hierarchy, resource icon semantics, route map semantics, and evidence-history treatment.

## 3. Functional Product Gates

- [x] 3.1 Verify cold-start user can generate and select executable paths.
- [x] 3.2 Verify generation is not fixed to `control-correction`.
- [x] 3.3 Verify paths include governed resource nodes and at least one checkpoint.
- [x] 3.4 Verify forbidden strings are absent from student-visible UI and page accessibility text.
- [x] 3.5 Verify skip warning, completed-node review, continued interaction, path deviation, checkpoint, and Konling adjustment events enter governed path activity.
- [x] 3.6 Verify desktop adaptive path pages use fluid AppShell workspace regions rather than centered fixed-width layouts.
- [x] 3.7 Verify mobile adaptive path pages use task-first responsive panels rather than squeezed desktop sidebars, tables, or multi-column layouts.
- [x] 3.8 Verify path comparison remains a comparable list, table, or information grid and does not become isolated three-card marketing composition.

## 4. Independent Browser Review

- [x] 4.1 Run a browser-capable subagent to capture or inspect the required adaptive path center states.
- [x] 4.2 Run an independent visual review subagent with the handoff, all four concept image paths, implementation screenshots, changed files, and evidence artifacts.
- [x] 4.3 Require PASS/BLOCK findings for handoff alignment, concept adoption, AppShell continuity, Konling dock, icon semantics, path map clarity, history/evidence hierarchy, cold-start usability, theme parity, mobile behavior, text fit, and forbidden strings.
- [x] 4.4 Treat every unresolved BLOCK as a final QA blocker and re-run review after fixes.

## 5. Final Gate

- [x] 5.1 Confirm all child changes in this series have passed targeted OpenSpec validation.
- [x] 5.2 Run commercial UI governance checks and targeted adaptive path tests.
- [x] 5.3 Save final QA evidence manifest with current commit, route matrix, screenshot paths, subagent review result, and temporary exceptions.
- [x] 5.4 Run `rtk openspec validate govern-adaptive-path-product-qa --strict`.
