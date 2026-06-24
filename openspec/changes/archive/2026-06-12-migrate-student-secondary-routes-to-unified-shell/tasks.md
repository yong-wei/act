## 1. Learning Entry Migration

- [x] 1.1 Replace `/interactive-learning` page-local `UnifiedTopBar` with AppShell learning-atlas shell behavior.
- [x] 1.2 Replace `/interactive-learning/courses` page-local `UnifiedTopBar` and `interactive-course-hub-*` shell ownership with AppShell learning-atlas shell behavior.
- [x] 1.3 Replace `/interactive-learning/chapter-components` and `/interactive-learning/cross-domain-exploration` page-local `UnifiedTopBar` usage with the same learning-atlas shell, or register a narrow temporary exception with owner and removal condition.
- [x] 1.4 Preserve current learning work, course launch actions, component-library secondary placement, cross-domain exploration entry, and mobile first-viewport usefulness.

## 2. Adaptive Practice Navigation

- [x] 2.1 Align `/assessment/adaptive-practice` navigation with the central student secondary route family.
- [x] 2.2 Preserve unauthenticated, loading, low-evidence, fallback, generated-question, and demo states.
- [x] 2.3 Ensure learner record and evidence review actions remain distinct from platform data center actions.

## 3. Verification

- [x] 3.1 Add route/navigation contract tests for Interactive Learning, course catalog, first-hop Interactive Learning destinations, and adaptive practice.
- [x] 3.2 Capture visual evidence for desktop, collapsed desktop navigation where applicable, and 320px mobile behavior.
- [x] 3.3 Run relevant commercial student entry and platform role navigation tests.
- [x] 3.4 Run `rtk openspec validate migrate-student-secondary-routes-to-unified-shell --strict`.

## Evidence

- Shared shell: `src/features/interactive/interactive-learning-shell.tsx` wraps the migrated student secondary routes in `AppShell` with `sidebarMode="collapsible"`.
- Migrated routes: `/interactive-learning`, `/interactive-learning/courses`, `/interactive-learning/chapter-components`, `/interactive-learning/cross-domain-exploration`, and `/assessment/adaptive-practice`.
- Browser evidence: `artifacts/commercial-ui/student-secondary-routes-414/manifest.json`; covers light/dark, desktop expanded, desktop collapsed, and 320px mobile behavior for all five routes.
- Geometry evidence: desktop expanded `248px 1192px`, collapsed `72px 1368px`; mobile evidence reports no persistent sidebar.
- Validation: `npm run test:unit -- src/lib/__tests__/platform-ui-contracts.test.ts src/lib/__tests__/platform-role-navigation.test.ts`, `npm run test:commercial-ui-governance`, `npx tsc --noEmit --pretty false`.
