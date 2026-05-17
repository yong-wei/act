## 1. Arena Shell And Hall Acceptance

- [ ] 1.1 Update `src/features/arena/arena-page-shell.tsx` so Arena breadcrumbs render `首页 > 竞技场首页` on the hall and reserve the right side for the same personal-center entry pattern used on the homepage.
- [ ] 1.2 Replace the Arena left navigation entries with `虚拟仿真`, `竞技场`, `知识图谱`, and `互动学习`, and remove public review or unrelated module entries from that shell.
- [ ] 1.3 Make the Arena shell navigation and page background theme-aware so light mode uses light surfaces and dark mode uses dark surfaces.
- [ ] 1.4 Refactor `src/features/arena/arena-hall.tsx` so the title/status region and search/filter region render as equal-height, equal-width layout peers on desktop.
- [ ] 1.5 Render Arena challenge cards as a two-column grid on desktop and a one-column grid on narrow screens while keeping primary actions and task status readable.
- [ ] 1.6 Phase acceptance: verify `/arena` in browser at desktop and mobile widths in light and dark modes, confirming the four-entry navigation, personal-center entry, compact hall header/search layout, and responsive challenge grid.

## 2. Challenge Detail And Arena-Bound Workbench Layout Acceptance

- [ ] 2.1 Update `src/features/arena/challenge-detail.tsx` so challenge detail breadcrumbs render `首页 > 竞技场首页 > 具体挑战名称` with the concrete challenge name, not only the route id.
- [ ] 2.2 Make challenge detail surfaces, cards, and text theme-aware so dark mode does not render white content backgrounds.
- [ ] 2.3 Refactor the Arena-bound control workbench layout so session or challenge status appears at the top before analysis panels.
- [ ] 2.4 Remove the legacy titled workbench shell frame for Arena-bound workbench pages and let the panel area use the full available content width.
- [ ] 2.5 Preserve challenge context and `arenaTask` binding after shell removal so official submission controls still target the active Arena challenge.
- [ ] 2.6 Phase acceptance: verify one supported challenge detail page and its control-workbench entry in browser, confirming breadcrumb labels, dark/light rendering, top status placement, full-width panel area, and preserved Arena task context.

## 3. Panel Instance Layout Acceptance

- [ ] 3.1 Introduce a panel instance state model for the control workbench with per-instance identity, view type, title, selected options, and settings.
- [ ] 3.2 Add a compatibility adapter that converts existing preset or view configuration defaults into initial panel instances.
- [ ] 3.3 Derive default panel sets from the active challenge mode or preset without enabling views that are unavailable for the current session.
- [ ] 3.4 Add controls that let students add allowed panel types and remove existing panel instances.
- [ ] 3.5 Support multiple visible panel instances with the same view type while keeping their selected options and settings independent.
- [ ] 3.6 Phase acceptance: verify through tests or browser interaction that adding, deleting, and duplicating panels does not reset unrelated panels and does not expose unavailable views.

## 4. Per-Panel View Configuration Acceptance

- [ ] 4.1 Move time-domain panel configuration into the panel title configuration area while preserving its existing selectable signals and disabled-state behavior.
- [ ] 4.2 Move Bode panel configuration into the panel title configuration area while preserving valid curve overlay behavior.
- [ ] 4.3 Move root-locus panel configuration into the panel title configuration area while preserving single-source selection behavior.
- [ ] 4.4 Change Nyquist panel configuration to single-source selection and prevent uncorrected and corrected Nyquist curves from overlaying in the same panel.
- [ ] 4.5 Persist configuration by panel instance for the active browser session so changes survive local workbench navigation without mutating sibling panels.
- [ ] 4.6 Phase acceptance: create two panels of the same type in browser, configure them differently, and confirm each panel renders only its own selected options; separately confirm Nyquist behaves as a single-select view.

## 5. Official Evaluation Failure Acceptance

- [ ] 5.1 Identify the project-supported student test account or fixture account for browser validation without adding credentials to the change artifacts.
- [ ] 5.2 Reproduce the `Arena evaluation failed` submit failure from a student-authenticated browser session and record the failing request, response, console, or server-log evidence.
- [ ] 5.3 Add a focused regression test, fixture, or scripted validation around the confirmed failure layer before applying the fix.
- [ ] 5.4 Repair the confirmed failure in the narrowest layer required: submit payload mapping, `/api/arena/evaluate`, evaluator semantics, persistence, or UI error handling.
- [ ] 5.5 Phase acceptance: submit a valid supported controller artifact from the Arena-bound workbench as a student, confirm the UI no longer shows generic `Arena evaluation failed`, and confirm the official result is persisted or a specific Chinese validation reason is shown.

## 6. Regression And Integration Acceptance

- [ ] 6.1 Run `npm run lint` and fix any regressions caused by this change.
- [ ] 6.2 Run the relevant focused tests for Arena, workbench view configuration, and official evaluation, plus `npm run test` if the focused set does not cover the changed shared logic.
- [ ] 6.3 Run `npm run build` and fix any build regressions.
- [ ] 6.4 Run `rtk openspec validate arena-ui-responsive-panel-workbench --strict` and keep all change specs valid.
- [ ] 6.5 Capture browser verification notes for `/arena`, one challenge detail page, one Arena-bound workbench, panel add/remove/configuration, Nyquist single selection, and student official submission.
- [ ] 6.6 Open the implementation PR against `integration`; do not target `main`.
