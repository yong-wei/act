## 1. QA Matrix

- [ ] 1.1 Define the route and state matrix for interactive learning product QA.
- [ ] 1.2 Include atlas, course catalog, chapter components, cross-domain list, course entry, teacher waiting, student runtime, guest/demo runtime, teacher projection runtime, invalid session, representative module states, Konling dock, light/dark, desktop/mobile, and focus management.
- [ ] 1.3 Define evidence metadata for route, role, theme, viewport, navigation state, dock state, page state, module state, source concept, and result.

## 2. Per-Change Design QA Aggregation

- [ ] 2.1 Require `unify-interactive-learning-atlas-shell` design-qa result to be present and passed.
- [ ] 2.2 Require `migrate-interactive-course-entry-shell` design-qa result to be present and passed.
- [ ] 2.3 Require `standardize-interactive-classroom-entry` design-qa result to be present and passed.
- [ ] 2.4 Require `standardize-lesson-runtime-shell` design-qa result to be present and passed.
- [ ] 2.5 Require `define-interactive-module-visual-standards` design-qa result to be present and passed.

## 3. Governance Checks

- [ ] 3.1 Add checks that interactive learning and course runtime pages use shared shell/navigation/dock contracts.
- [ ] 3.2 Add checks that teacher projection pages do not show student answer inputs, permanent right drawers, top duplicate next-page buttons, or oversized bottom navigation.
- [ ] 3.3 Add checks that teacher projection bottom navigation includes a page-jump dropdown and consistent page count state.
- [ ] 3.4 Add checks that Konling remains the shared right-bottom floating dock and is not integrated into course right rails, local tool columns, or module panels.
- [ ] 3.5 Add checks that student/guest pages do not show teacher statistics, evidence status, or class analytics.
- [ ] 3.6 Add checks that course entry and runtime pages do not reintroduce `premium-lesson-*` as their primary shell.
- [ ] 3.7 Add checks that standard module chrome is registered and no course-local unregistered variants are used.

## 4. Independent Visual Review

- [ ] 4.1 Run an independent visual review subagent with `design-handoff.md`, accepted concept image paths, implementation screenshots, changed files, and evidence artifacts.
- [ ] 4.2 Require PASS/BLOCK findings for atlas, entry, waiting, runtime modes, module chrome, AppShell continuity, Konling dock, theme parity, mobile behavior, accessibility, and concept alignment.
- [ ] 4.3 Treat every unresolved BLOCK as a final QA blocker.
- [ ] 4.4 Re-run visual subagent review after blocking fixes until no blocking findings remain.

## 5. Final Gate

- [ ] 5.1 Run relevant unit/component tests, commercial UI governance checks, and targeted browser validation against hydrated `http://localhost:3001` or the active local URL.
- [ ] 5.2 Save final product QA evidence and handoff-to-implementation matrix.
- [ ] 5.3 Document temporary exceptions with owner and removal condition.
- [ ] 5.4 Run `rtk openspec validate govern-interactive-learning-product-qa --strict`.

## 6. Issue Dependency Gate

- [ ] 6.1 Confirm this issue is blocked by `unify-interactive-learning-atlas-shell`.
- [ ] 6.2 Confirm this issue is blocked by `migrate-interactive-course-entry-shell`.
- [ ] 6.3 Confirm this issue is blocked by `standardize-interactive-classroom-entry`.
- [ ] 6.4 Confirm this issue is blocked by `standardize-lesson-runtime-shell`.
- [ ] 6.5 Confirm this issue is blocked by `define-interactive-module-visual-standards`.
- [ ] 6.6 Confirm this issue is in series `interactive-learning-ui-redesign`.
