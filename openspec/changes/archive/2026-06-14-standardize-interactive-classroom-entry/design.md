## Design Source

Authoritative source: `artifacts/product-design-audits/interactive-learning-2026-06-14/design-handoff.md`.

Reference image:

- `concepts/revised/02-teacher-classroom-qr-waiting.png`

## Design Decisions

- The waiting page is a pre-class state, not the projection runtime page.
- Joined student count is a primary state and must remain in the main visual hierarchy on both desktop and mobile.
- `开始上课` is the primary action and transitions into teacher projection runtime.
- Keep AppShell, breadcrumbs, theme/user controls, and Konling dock consistent.

## Visual QA Gate

QA must compare the waiting page implementation against the reference concept and handoff. The report must include source visual paths, implementation screenshot paths, same viewport/theme/state comparison, findings, fixes, and `final result: passed`. Missing QR/class code, hidden joined count, missing start action, duplicated local topbar, or mismatched platform shell is blocking.

## Dependency And Issue Registration

- Blocked by `migrate-interactive-course-entry-shell`.
- Must be registered under series `interactive-learning-ui-redesign`.
- Blocks final `govern-interactive-learning-product-qa`.
