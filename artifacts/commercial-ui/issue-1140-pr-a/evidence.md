# Issue 1140 PR A Browser Evidence

## Successful Lifecycle Evidence

- Code checkpoint: `73b1af2d34d07391249bfcfddbed2786b3644639`
- Captured at: `2026-08-01T04:14:02.936Z`
- Route: `/assessment/adaptive-practice?goal=control-correction&intent=contextual-recommendation`
- Fixture authority: authenticated demo learner with Playwright route fixtures scoped to the registered `control-correction` goal.
- Machine-readable record: `lifecycle-manifest.json`

| Viewport | File | SHA-256 |
| --- | --- | --- |
| 1440 x 1000 desktop | `lifecycle-success-desktop-1440.png` | `651a466a7edb3201ed4d478fbfa2a34afd5757de78fec81cc3a2c17ec88fa72a` |
| 320 x 900 mobile | `lifecycle-success-mobile-320.png` | `0d15c0f2b6fd6fa5e2a59bf69a3043dc9289168e0a713d4babff51719dec20ac` |

The production page and Konling sidebar wiring were exercised in both viewports. Each run observed four POST requests. The first three requests used the same ID across a lost response, a running result, and a definitive failed result. The fourth explicit generation used a new ID and succeeded. The test also verified synchronous duplicate admission, pending and running target lock, all four sidebar lifecycle states, unchanged page URL, and learner-state plus path refreshes after success.

The manifest records the exact request IDs, refresh counts, source hashes, screenshot hashes, capture time, route, and code checkpoint. A non-update Playwright run verifies that these sources and screenshots remain bound to the recorded checkpoint.

## Supplemental Fail-Closed Evidence

The earlier `fail-closed-generation-desktop-1440.png` and `fail-closed-generation-mobile-320.png` captures remain as supplemental evidence of the real learner-safe failure state. They are not used as proof of successful generation.

## Verification

- Lifecycle browser test and evidence binding: 3 passed at 1440px and 320px.
- Focused Vitest route, lifecycle, and adaptive learning center contracts: 71 passed.
- ESLint on changed source and tests: passed.
- `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck`: passed with exit code 0.
- OpenSpec strict validation: passed.
- `git diff --check`: passed.
