# Adaptive Path Continuous Journey Visual Acceptance

Captured from the controlled `demo=1` path-execution route on 2026-07-11 with Playwright and a fresh Next development server.

| Theme | Width | Screenshot | SHA-256 |
| --- | ---: | --- | --- |
| light | 1440 | `visual-acceptance/light-1440.png` | `f87d2e35c354b4a0faae04435cda2a9df39a561327daa8c088f36340825c5bd4` |
| light | 375 | `visual-acceptance/light-375.png` | `edc1303273ebe9f0232fe873695389ffaa361e423abb39724478472ddf854fd5` |
| light | 320 | `visual-acceptance/light-320.png` | `ede21cfeff9e24c2d4178b803f1f946afb2095de93322b05c26014637f148cde` |
| dark | 1440 | `visual-acceptance/dark-1440.png` | `394be6b05ea851c9bd96b716e13b82b1f8589b9331be53df7b81994ab3e716de` |
| dark | 375 | `visual-acceptance/dark-375.png` | `43a9aa71a864623328a62f53e7f53679fce44b7bc9dd591f825df465fba2bde8` |
| dark | 320 | `visual-acceptance/dark-320.png` | `b0b41e5eb24e3a96b9089c26c5c8406c871def9192e6fdb25a5af7a9cdd13290` |

## Inspection

- All six captures show the compact journey before learning history and resource modules.
- Current, completed, and locked states remain distinguishable independently of resource-type color in both themes.
- The focused node keeps its recommendation, evidence, result, start, and skip actions inline at all widths.
- The 375px and 320px layouts remain a single readable column. Long titles and `AdaptiveAssessmentAnswer` wrap without horizontal clipping.
- Automated geometry checks confirm document, execution surface, timeline, focused node, and attached actions remain within the viewport with no internal horizontal overflow.
- The floating assistant launcher stays outside the focused action area. No inspected screenshot showed clipped actions, overlapping text, or unreachable journey controls.

Evidence update: `UPDATE_VISUAL_EVIDENCE=1 npm run test:integration -- tests/adaptive-path-compact-workspace.spec.ts tests/adaptive-path-arena-journey.spec.ts tests/adaptive-path-visual-acceptance.spec.ts` (8 passed).

Default verification uses the same command without `UPDATE_VISUAL_EVIDENCE`; it writes current captures under `test-results/`, compares them with these tracked images using geometry and bounded pixel-difference gates, and leaves tracked evidence unchanged.
