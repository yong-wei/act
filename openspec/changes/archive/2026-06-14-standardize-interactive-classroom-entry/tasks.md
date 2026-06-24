## 1. Waiting State

- [x] 1.1 Define a standard teacher classroom waiting page.
- [x] 1.2 Show QR code, class code, joined student count, and `开始上课`.
- [x] 1.3 Ensure the transition from waiting to teacher runtime is explicit.

## 2. Shell Continuity

- [x] 2.1 Keep AppShell, breadcrumbs, user center, theme toggle, and Konling dock consistent.
- [x] 2.2 Avoid showing full projection content before class starts.

## 3. Visual QA

- [x] 3.1 Capture desktop, mobile, light, and dark waiting-state screenshots.
- [x] 3.2 Save the QA report under this change's evidence directory with source visual paths, implementation screenshot paths, viewport, theme, state, and comparison findings.
- [x] 3.3 Run Product Design `design-qa` against `design-handoff.md` and `concepts/revised/02-teacher-classroom-qr-waiting.png`.
- [x] 3.4 Fix every P0/P1/P2 mismatch and rerun QA until `final result: passed`.
- [x] 3.5 Run `rtk openspec validate standardize-interactive-classroom-entry --strict`.

## 4. Issue Dependency Gate

- [x] 4.1 Confirm this issue is blocked by `migrate-interactive-course-entry-shell`.
- [x] 4.2 Confirm this issue is in series `interactive-learning-ui-redesign`.
