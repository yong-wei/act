## Design Source

Authoritative source: `artifacts/product-design-audits/interactive-learning-2026-06-14/design-handoff.md`.

Reference images:

- `concepts/revised/03-student-guest-runtime.png`
- `concepts/revised/06-teacher-projection-runtime-compact-navigation.png`

## Design Decisions

- Runtime mode is role-aware: student, guest/demo, teacher projection, and invalid session are separate visual states.
- Student and guest views are similar, but guest/demo must not claim authenticated evidence or real submission status.
- Teacher projection prioritizes teaching content, diagram, question stems, and module controls.
- Teacher projection does not show student answer input boxes.
- Teacher right-side tools are collapsed by default; no permanent right drawer.
- Top navigation must not duplicate the bottom next-page action.
- Bottom runtime navigation is compact and includes previous/next, BOPPPS stage indicator, page count, and page-jump dropdown.

## Visual QA Gate

This change must produce separate design-qa reports or a single report with separate sections for student/guest and teacher projection. Each section must compare the same viewport/theme/state against its source image and the handoff.

Blocking mismatches include missing shell continuity, missing breadcrumbs, duplicated local topbar, permanent right drawer, oversized bottom navigation, missing page-jump dropdown, top duplicate next-page button, teacher answer input boxes, or teacher-only stats in student/guest mode.

## Dependency And Issue Registration

- Blocked by `migrate-interactive-course-entry-shell`.
- Blocked by `define-interactive-module-visual-standards`.
- Must be registered under series `interactive-learning-ui-redesign`.
- Blocks final `govern-interactive-learning-product-qa`.
