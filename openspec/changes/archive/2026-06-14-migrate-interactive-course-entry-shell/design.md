## Design Source

Authoritative source: `artifacts/product-design-audits/interactive-learning-2026-06-14/design-handoff.md`.

Reference image:

- `concepts/02-course-entry-shell.png`

## Design Decisions

- Course entry is a product workspace entry, not a standalone course microsite.
- Teacher, student, guest, and self-study actions share one entry shell but have distinct labels and visibility.
- Student and guest paths must not expose teacher-only submission overview, evidence status, or class analytics.
- Resource and knowledge-path panels may use columns on desktop but must collapse into readable sequence on mobile.

## Visual QA Gate

The change must produce design-qa evidence for at least two representative course entries, including `unit-1-1-see-the-full-picture`. QA must compare source and implementation at the same viewport/theme/state and pass with no P0/P1/P2 findings.

Blocking mismatches include continued primary use of `PremiumLessonEntryPage`, missing AppShell/breadcrumb/Konling, fixed full-page 1180px layout, or teacher-only content visible in student/guest entry contexts.

## Dependency And Issue Registration

- Blocked by `unify-interactive-learning-atlas-shell`.
- Must be registered under series `interactive-learning-ui-redesign`.
- Unlocks `standardize-interactive-classroom-entry` and is one blocker for `standardize-lesson-runtime-shell`.
