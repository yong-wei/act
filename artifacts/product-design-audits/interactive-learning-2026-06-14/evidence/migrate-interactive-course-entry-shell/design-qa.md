# Course Entry Shell Design QA

Change: `migrate-interactive-course-entry-shell`
Routes:
- `/interactive-learning/courses/unit-1-1-see-the-full-picture`
- `/interactive-learning/courses/unit-4-1-design-task-expression`
Date: 2026-06-15

## Source Visuals

- Handoff: `artifacts/product-design-audits/interactive-learning-2026-06-14/design-handoff.md`
- Concept: `artifacts/product-design-audits/interactive-learning-2026-06-14/concepts/02-course-entry-shell.png`

## Implementation Evidence

- Desktop dark: `artifacts/product-design-audits/interactive-learning-2026-06-14/evidence/migrate-interactive-course-entry-shell/course-entry-desktop-dark.png`
- Desktop light: `artifacts/product-design-audits/interactive-learning-2026-06-14/evidence/migrate-interactive-course-entry-shell/course-entry-desktop-light.png`
- Mobile light: `artifacts/product-design-audits/interactive-learning-2026-06-14/evidence/migrate-interactive-course-entry-shell/course-entry-mobile-light.png`
- Mobile dark: `artifacts/product-design-audits/interactive-learning-2026-06-14/evidence/migrate-interactive-course-entry-shell/course-entry-mobile-dark.png`
- Unit 4-1 desktop dark: `artifacts/product-design-audits/interactive-learning-2026-06-14/evidence/migrate-interactive-course-entry-shell/course-entry-unit-4-1-desktop-dark.png`
- Unit 4-1 desktop light: `artifacts/product-design-audits/interactive-learning-2026-06-14/evidence/migrate-interactive-course-entry-shell/course-entry-unit-4-1-desktop-light.png`
- Unit 4-1 mobile light: `artifacts/product-design-audits/interactive-learning-2026-06-14/evidence/migrate-interactive-course-entry-shell/course-entry-unit-4-1-mobile-light.png`
- Unit 4-1 mobile dark: `artifacts/product-design-audits/interactive-learning-2026-06-14/evidence/migrate-interactive-course-entry-shell/course-entry-unit-4-1-mobile-dark.png`
- Browser capture: `artifacts/product-design-audits/interactive-learning-2026-06-14/evidence/migrate-interactive-course-entry-shell/browser-capture.json`

## Viewports And State

- Desktop: 1440 x 960, light and dark.
- Mobile: 390 x 844, light and dark.
- AppShell layout: `collapsible`.
- Route frame: `learning-atlas`, derived from the canonical route inventory.
- Navigation layers: `global-product contextual-workspace local-tool`.
- Route ledger coverage: all concrete `src/app/interactive-learning/courses/*/page.tsx` entry routes resolve through `/interactive-learning/courses/[courseId]` or a more specific inventory entry.
- Navigation state: `collapsed`.
- Console errors: 0 in all captured states across both representative routes.

## Comparison Findings

- Course identity, tags, runtime-derived page count, module count, and estimated duration are visible before role actions.
- Course entry modes are separated into teacher launch, student join, and guest demo actions.
- Unit route preview and BOPPPS path summary are visible before self-study materials, matching the concept's entry-first information architecture.
- The Unit 4-1 representative route uses the same shell frame, role action separation, and mobile/desktop hierarchy as Unit 1-1, showing the CourseEntryShell generalizes beyond the first course.
- Self-study media and knowledge path remain available below the entry decision area.
- The page uses shared AppShell chrome, platform tokens, collapsed global navigation, and the shared bottom-right Konling dock. No page-local Konling dock is registered.
- Mobile keeps the same navigation logic and content order without overlapping controls or clipped action text.

## Findings

- P0: none.
- P1: none.
- P2: none.

## Final Result

passed
