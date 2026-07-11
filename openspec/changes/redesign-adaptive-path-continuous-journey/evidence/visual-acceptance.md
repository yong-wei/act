# Adaptive Path Continuous Journey Visual Acceptance

Captured from the controlled `demo=1` path-execution route on 2026-07-11 with Playwright and a fresh Next development server.

| Theme | Width | Screenshot | SHA-256 |
| --- | ---: | --- | --- |
| light | 1440 | `visual-acceptance/light-1440.png` | `36a28307513e7de0d4eef18ea4d5b7eb3ca70c8d5150a1f1ad659868107ccd9b` |
| light | 375 | `visual-acceptance/light-375.png` | `36be88735c7488a3052aa47de53b8a0bd718b1a822cb543c9823648b57aa5642` |
| light | 320 | `visual-acceptance/light-320.png` | `cca33dde20de7eb8dd01e123ada3c4dbb7d5763f028cdc3de6740e3aa3e4d458` |
| dark | 1440 | `visual-acceptance/dark-1440.png` | `f7d6ed7a9d48220c92176658cca4888342ad7648430d1c97811aea1f41664103` |
| dark | 375 | `visual-acceptance/dark-375.png` | `0965278adeed7e91d878ad443418d1091f914f6f1b1aa176700a81a60dd940ea` |
| dark | 320 | `visual-acceptance/dark-320.png` | `780dd652967bb3c15c7b4f608ca6779a434a6be7b955881338fa40a21b4ed686` |

## Inspection

- All six captures show the compact journey before learning history and resource modules.
- Current, completed, and locked states remain distinguishable independently of resource-type color in both themes.
- The focused node keeps its recommendation, evidence, result, start, and skip actions inline at all widths.
- The 375px and 320px layouts remain a single readable column. Long titles and `AdaptiveAssessmentAnswer` wrap without horizontal clipping.
- Automated geometry checks confirm document, execution surface, timeline, focused node, and attached actions remain within the viewport with no internal horizontal overflow.
- The floating assistant launcher stays outside the focused action area. No inspected screenshot showed clipped actions, overlapping text, or unreachable journey controls.

Command: `PLAYWRIGHT_PORT=3413 npx playwright test tests/adaptive-path-visual-acceptance.spec.ts --workers=1` (6 passed).
