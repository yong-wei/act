## 1. Learning Entry Migration

- [ ] 1.1 Replace `/interactive-learning` page-local `UnifiedTopBar` with AppShell learning-atlas shell behavior.
- [ ] 1.2 Replace `/interactive-learning/courses` page-local `UnifiedTopBar` and `interactive-course-hub-*` shell ownership with AppShell learning-atlas shell behavior.
- [ ] 1.3 Replace `/interactive-learning/chapter-components` and `/interactive-learning/cross-domain-exploration` page-local `UnifiedTopBar` usage with the same learning-atlas shell, or register a narrow temporary exception with owner and removal condition.
- [ ] 1.4 Preserve current learning work, course launch actions, component-library secondary placement, cross-domain exploration entry, and mobile first-viewport usefulness.

## 2. Adaptive Practice Navigation

- [ ] 2.1 Align `/assessment/adaptive-practice` navigation with the central student secondary route family.
- [ ] 2.2 Preserve unauthenticated, loading, low-evidence, fallback, generated-question, and demo states.
- [ ] 2.3 Ensure learner record and evidence review actions remain distinct from platform data center actions.

## 3. Verification

- [ ] 3.1 Add route/navigation contract tests for Interactive Learning, course catalog, first-hop Interactive Learning destinations, and adaptive practice.
- [ ] 3.2 Capture visual evidence for desktop, collapsed desktop navigation where applicable, and 320px mobile behavior.
- [ ] 3.3 Run relevant commercial student entry and platform role navigation tests.
- [ ] 3.4 Run `rtk openspec validate migrate-student-secondary-routes-to-unified-shell --strict`.
