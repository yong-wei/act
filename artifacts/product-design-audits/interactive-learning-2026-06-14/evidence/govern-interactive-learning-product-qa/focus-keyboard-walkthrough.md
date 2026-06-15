# Interactive Learning Focus And Keyboard Walkthrough

Change: `govern-interactive-learning-product-qa`

## Scope

This walkthrough covers the final QA focus-management requirement for the accepted interactive learning handoff.

## Evidence Chain

- `artifacts/interactive-learning-atlas-shell-502/design-qa.md`
- `artifacts/product-design-audits/interactive-learning-2026-06-14/evidence/migrate-interactive-course-entry-shell/design-qa.md`
- `artifacts/product-design-audits/interactive-learning-2026-06-14/evidence/standardize-interactive-classroom-entry/design-qa.md`
- `artifacts/product-design-audits/interactive-learning-2026-06-14/evidence/standardize-lesson-runtime-shell/design-qa.md`
- `artifacts/product-design-audits/interactive-learning-2026-06-14/module-visual-standards-504/design-qa.md`
- `src/features/interactive/shared/lesson-runtime-shell.tsx`
- `src/features/interactive/shared/step-knowledge-drawer.tsx`
- `src/components/platform/app-shell.tsx`

## Keyboard Path Checks

| Surface | Expected keyboard path | Evidence |
| --- | --- | --- |
| Atlas and catalog AppShell | Tab reaches collapsed platform navigation, breadcrumbs, theme/account controls and right-bottom dock without a persistent mobile sidebar. | Atlas design QA and commercial UI route evidence cover collapsed navigation, mobile command surface and dock continuity. |
| Course entry | Tab reaches teacher launch, join code, join action, guest demo and self-study/resource sections while preserving AppShell controls. | Course entry design QA and browser capture list the four primary actions and route regions. |
| Teacher waiting | Tab reaches QR/class code region, joined count and start-class action before entering runtime. | Classroom entry design QA and screenshots cover waiting state and start-class primary action. |
| Student and guest runtime | Tab reaches lesson local tools, activity controls, page jump select and shared dock; guest mode copy states local preview only. | Runtime design QA, runtime diagnostics and `LessonRuntimeShell` contract cover bottom navigation, page jump and guest preview copy. |
| Teacher projection runtime | Tab reaches module-attached release/reveal controls, local tools, compact page jump select and shared dock; no student answer input is focusable. | Runtime design QA and platform UI contract checks cover no student input, no top duplicate next action and page-jump presence. |
| Module chrome | Registered module chrome exposes state-specific controls without course-local unregistered visual variants. | Module visual standards QA and module chrome governance cover representative content, choice, ordering, teacher control and fallback states. |

## Result

PASS. The final QA evidence now contains a dedicated focus/keyboard walkthrough and the commercial UI governance gate requires this file through the independent visual review report.
