# PR #1387 Commercial UI Evidence

Capture revision: `f22c047`

## Affected routes

- `/interactive-learning/resources/lesson13-cruise-bridge` with a valid adaptive path launch context.
- `/assessment/adaptive-practice?goal=control-correction` after using `返回学习路径`.

## Verified flow

The resource page was opened with `source=adaptive-path-center`, a valid `pathId` and `nodeId`, and `intent=path-execution`.

- Desktop (1440×1100): return href was `/assessment/adaptive-practice?goal=control-correction`; clicking it landed at the same goal-only URL.
- Mobile (320×1200): return href was `/assessment/adaptive-practice?goal=control-correction`; clicking it landed at the same goal-only URL.
- The execution and candidate parameters were absent from the final URL.
- The center fallback rendered when the demo database had no matching saved path; this is the expected recoverable empty-state, and the route no longer remained in the resource execution workspace.

## Captures

- `resource-desktop.png`
- `resource-mobile-320.png`
- `center-after-return-desktop.png`
- `center-after-return-mobile-320.png`
- `return-flow-evidence.json`

The Next development HMR WebSocket emitted non-blocking handshake errors during capture; HTTP navigation, return href, final URL, and screenshots completed successfully.
