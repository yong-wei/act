## 1. CourseEntryShell

- [ ] 1.1 Define the CourseEntryShell layout under AppShell.
- [ ] 1.2 Migrate representative unit entry pages and then generalize across `unit-*` entries.
- [ ] 1.3 Preserve teacher start, student join, guest/demo, self-study, resource, and knowledge-path actions.
- [ ] 1.4 Remove primary entry-page dependence on `premium-lesson-*` shell framing.

## 2. Role Visibility

- [ ] 2.1 Verify teacher-only content stays out of student and guest entry contexts.
- [ ] 2.2 Verify guest/demo mode is distinct from authenticated student evidence behavior.

## 3. Visual QA

- [ ] 3.1 Capture representative desktop, mobile, light, and dark screenshots.
- [ ] 3.2 Save the QA report under this change's evidence directory with source visual paths, implementation screenshot paths, viewport, theme, state, and comparison findings.
- [ ] 3.3 Run Product Design `design-qa` against `design-handoff.md` and `concepts/02-course-entry-shell.png`.
- [ ] 3.4 Fix all P0/P1/P2 findings and rerun QA until `final result: passed`.
- [ ] 3.5 Run `rtk openspec validate migrate-interactive-course-entry-shell --strict`.

## 4. Issue Dependency Gate

- [ ] 4.1 Confirm this issue is blocked by `unify-interactive-learning-atlas-shell`.
- [ ] 4.2 Confirm this issue is in series `interactive-learning-ui-redesign`.
