# Adaptive Path Continuous Journey Visual Acceptance

Captured from the controlled `demo=1` path-execution route on 2026-07-11 with Playwright and a fresh Next development server.

| Theme | Width | Screenshot | SHA-256 |
| --- | ---: | --- | --- |
| light | 1440 | `visual-acceptance/light-1440.png` | `340da1a135d87cc1fa5ba63090219ec6791177d9d7cbeee89906b1963253fec1` |
| light | 375 | `visual-acceptance/light-375.png` | `fef28619273f877b6c10ebf9fe97b19f7dd42a58163ba3c918d2b78108c3b1a1` |
| light | 320 | `visual-acceptance/light-320.png` | `0b0a5d4be7e636cb1aa97314eccde329d1316a6c73900874b64702ebb89b9842` |
| dark | 1440 | `visual-acceptance/dark-1440.png` | `756a4b6c1438227651f8b60a512e49c2b930bc5fa18c4a4cc587dbc83a14dbe8` |
| dark | 375 | `visual-acceptance/dark-375.png` | `bc3907abd8990d19cb5fbb475d7f0e6d64ffb6a0875e8828c673a0d00b846771` |
| dark | 320 | `visual-acceptance/dark-320.png` | `995d3a67c110a50614c296bc904c645ef92dbda6b5cfe733ab58ec972ba53002` |

## Inspection

- All six captures show the compact journey before learning history and resource modules.
- Current, completed, and locked states remain distinguishable independently of resource-type color in both themes.
- The focused node keeps its recommendation, evidence, result, start, and skip actions inline at all widths.
- The 375px and 320px layouts remain a single readable column. Long titles and `AdaptiveAssessmentAnswer` wrap without horizontal clipping.
- Automated geometry checks confirm document, execution surface, timeline, focused node, and attached actions remain within the viewport with no internal horizontal overflow.
- The floating assistant launcher stays outside the focused action area. No inspected screenshot showed clipped actions, overlapping text, or unreachable journey controls.

Command: `PLAYWRIGHT_PORT=3413 npx playwright test tests/adaptive-path-visual-acceptance.spec.ts --workers=1` (6 passed).
