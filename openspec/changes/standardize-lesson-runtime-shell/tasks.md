## 1. Runtime Shell

- [ ] 1.1 Define LessonRuntimeShell for student, guest/demo, teacher projection, and invalid-session states.
- [ ] 1.2 Preserve runtime manifest truth for steps, activities, submission state, teacher controls, and progress.
- [ ] 1.3 Remove primary reliance on course-local topbars and fixed `premium-lesson-main` containers.

## 2. Teacher Projection

- [ ] 2.1 Make teaching content and interaction question stems dominate the page.
- [ ] 2.2 Keep right-side tools collapsed by default and responsive.
- [ ] 2.3 Attach release, pause, progressive reveal, reference, and submission overview controls to each interaction module.
- [ ] 2.4 Remove top duplicate `下一页` action.
- [ ] 2.5 Add compact bottom navigation with page-jump dropdown.

## 3. Student And Guest Runtime

- [ ] 3.1 Keep student/guest content mostly aligned while separating authenticated submission evidence from demo browsing.
- [ ] 3.2 Ensure student/guest modes do not show teacher analytics, class statistics, or evidence status.
- [ ] 3.3 Provide clear invalid-session and resource-missing fallback states.

## 4. Visual QA

- [ ] 4.1 Capture student/guest desktop/mobile/light/dark runtime screenshots.
- [ ] 4.2 Capture teacher projection desktop/mobile/light/dark runtime screenshots.
- [ ] 4.3 Save runtime QA reports under this change's evidence directory with source visual paths, implementation screenshot paths, viewport, theme, role, page state, and comparison findings.
- [ ] 4.4 Run Product Design `design-qa` against `design-handoff.md`, `concepts/revised/03-student-guest-runtime.png`, and `concepts/revised/06-teacher-projection-runtime-compact-navigation.png`.
- [ ] 4.5 Fix all P0/P1/P2 findings and rerun QA until `final result: passed`.
- [ ] 4.6 Run `rtk openspec validate standardize-lesson-runtime-shell --strict`.

## 5. Issue Dependency Gate

- [ ] 5.1 Confirm this issue is blocked by `migrate-interactive-course-entry-shell`.
- [ ] 5.2 Confirm this issue is blocked by `define-interactive-module-visual-standards`.
- [ ] 5.3 Confirm this issue is in series `interactive-learning-ui-redesign`.
