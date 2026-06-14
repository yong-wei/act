## 1. Module Inventory

- [ ] 1.1 Map current standard manifest module kinds to shared visual chrome categories.
- [ ] 1.2 Identify legacy local visual variants that must be replaced or explicitly retired.
- [ ] 1.3 Document role, theme, viewport, and state variants for each category.

## 2. Shared Chrome

- [ ] 2.1 Implement or route modules through shared content chrome.
- [ ] 2.2 Implement or route interaction modules through shared answer/action chrome.
- [ ] 2.3 Implement teacher-control states attached to individual modules.
- [ ] 2.4 Implement student, guest, resource-missing, and invalid-state fallbacks.

## 3. Gates

- [ ] 3.1 Add tests that reject unregistered course-local module chrome for standard module kinds.
- [ ] 3.2 Add checks that teacher controls remain attached to the correct module.
- [ ] 3.3 Add checks for projection-safe typography and stable panel geometry.

## 4. Visual QA

- [ ] 4.1 Capture representative module screenshots across role/theme/viewport states.
- [ ] 4.2 Save the QA report under this change's evidence directory with source visual paths, implementation screenshot paths, viewport, theme, role, module state, and comparison findings.
- [ ] 4.3 Run Product Design `design-qa` for student/guest module states against `design-handoff.md` and `concepts/revised/03-student-guest-runtime.png`.
- [ ] 4.4 Run Product Design `design-qa` for teacher-control and projection module states against `design-handoff.md` and `concepts/revised/06-teacher-projection-runtime-compact-navigation.png`.
- [ ] 4.5 Fix all P0/P1/P2 findings and rerun QA until `final result: passed`.
- [ ] 4.6 Run `rtk openspec validate define-interactive-module-visual-standards --strict`.

## 5. Issue Dependency Gate

- [ ] 5.1 Confirm this issue is blocked by `persist-app-shell-navigation-preference` while that external change remains open.
- [ ] 5.2 Confirm this issue blocks `standardize-lesson-runtime-shell`.
- [ ] 5.3 Confirm this issue is in series `interactive-learning-ui-redesign`.
