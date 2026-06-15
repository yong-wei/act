# Lesson Runtime Shell Design QA

Change: `standardize-lesson-runtime-shell`

Final result: passed

QA runner: equivalent per-change design QA report. The current Codex session did not expose a callable Product Design `design-qa` tool; the accepted handoff allows `design-qa.md` or an equivalent child-change QA report.

## Source Visuals

- `artifacts/product-design-audits/interactive-learning-2026-06-14/design-handoff.md`
- `artifacts/product-design-audits/interactive-learning-2026-06-14/concepts/revised/03-student-guest-runtime.png`
- `artifacts/product-design-audits/interactive-learning-2026-06-14/concepts/revised/06-teacher-projection-runtime-compact-navigation.png`

## Implementation Screenshots

| State | Viewport | Theme | Screenshot |
| --- | --- | --- | --- |
| Guest runtime | 1440x960 | light | `screenshots/guest-runtime-1440x960-light.png` |
| Guest runtime | 390x844 | light | `screenshots/guest-runtime-390x844-light.png` |
| Guest runtime | 1440x960 | dark | `screenshots/guest-runtime-1440x960-dark.png` |
| Guest runtime | 390x844 | dark | `screenshots/guest-runtime-390x844-dark.png` |
| Student runtime | 1440x960 | light | `screenshots/student-runtime-1440x960-light.png` |
| Student runtime | 390x844 | light | `screenshots/student-runtime-390x844-light.png` |
| Student runtime | 1440x960 | dark | `screenshots/student-runtime-1440x960-dark.png` |
| Student runtime | 390x844 | dark | `screenshots/student-runtime-390x844-dark.png` |
| Teacher projection | 1440x960 | light | `screenshots/teacher-projection-1440x960-light.png` |
| Teacher projection | 390x844 | light | `screenshots/teacher-projection-390x844-light.png` |
| Teacher projection | 1440x960 | dark | `screenshots/teacher-projection-1440x960-dark.png` |
| Teacher projection | 390x844 | dark | `screenshots/teacher-projection-390x844-dark.png` |

Structured diagnostics: `runtime-visual-diagnostics.json`.

## Focused Comparison

- Student and guest runtime screenshots use `LessonRuntimeShell` inside `AppShell`, with breadcrumbs, theme toggle, user center continuity, and the shared right-bottom Konling dock.
- Guest runtime remains visually aligned with student runtime but is marked as demo browsing and does not expose authenticated evidence or real submission status.
- Guest runtime submission cards explicitly state that demo answers are local preview only and do not sync to teacher summaries.
- Student runtime shows authenticated classroom participation and preserved activity/submission contract markers.
- Teacher projection uses the same runtime shell, keeps teaching content and question stems as the dominant visual layer, and moves classroom code, QR, and session tools into a collapsed local tool rail.
- Teacher projection does not render student answer inputs, a permanent right drawer, or a top duplicate next-page action.
- Bottom lesson navigation is compact, includes previous/next, BOPPPS stage, page count, and a page-jump dropdown, and is rendered in normal document flow so it does not cover the main teaching image or question content.
- Light and dark screenshots are distinct and verified through `ai-obe-theme`, `themeClass`, and `storedTheme` diagnostics.
- Mobile screenshots preserve the platform navigation, collapsed local tools, page-jump dropdown, and right-bottom dock without horizontal overflow.

## Automated Diagnostics

- Captured states: 12.
- Student join-code lookup: `405` for the probe recorded in `runtime-visual-diagnostics.json`; demo and fixture routes remained renderable, so this status is treated as a diagnostic probe result rather than a visual QA pass condition.
- `hasRuntimeShell`: true for every state.
- `hasBottomNavigation`: true for every state.
- `hasPageJump`: true for every state.
- `localTools`: `collapsed` for every state.
- `hasNotFound`: false for every state.
- `hasTopDuplicateNext`: false for every state.
- `hasStudentAnswerInputInTeacherView`: false for teacher states.
- `hasTeacherOnlySummaryInStudentView`: false for student and guest states.
- `hasGuestTeacherSyncClaim`: false for guest states.
- `hasGuestPreviewCopy`: true for guest states.
- `viewportWidth` / `viewportHeight`: match requested browser viewport for every state.
- `navOverlapsContent`: false for every state.

## Viewport Evidence Integrity

- The mobile screenshots were recaptured with explicit browser viewport sizing after review found the first recapture had reused desktop viewport dimensions.
- Sample PNG dimensions:
  - `guest-runtime-390x844-light.png`: `392 x 5680`
  - `guest-runtime-1440x960-light.png`: `1440 x 3886`
  - `teacher-projection-390x844-dark.png`: `392 x 1959`
  - `teacher-projection-1440x960-dark.png`: `1440 x 2170`
- Sample SHA-256 values are distinct between mobile and desktop captures:
  - `guest-runtime-390x844-light.png`: `3eab240bbaea7b88bd39ccdd64c2a2ac667f15b78e0ec3a6d4daae770b1bafdb`
  - `guest-runtime-1440x960-light.png`: `7e1305bb17a4491ef5b7b65335d59616f2cf8d5b743f7aa1f60d63a80c4758dc`
  - `teacher-projection-390x844-dark.png`: `2b26d7076189f2447f72ad24eca6a87a7716b72472b26cae99338fa09544ec25`
  - `teacher-projection-1440x960-dark.png`: `1c47877f96d67493afe660ac31b197859e2ba3d330b140a7305db6b1e8139f2b`

## Blocking Findings

None.
