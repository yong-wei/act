# PR #1387 Commercial UI Evidence

Implementation and capture-script checkpoint: `0104095050c8b50f7a5f85ed1c39cc074cb626e7`

Capture time: `2026-08-14T09:28:14.772Z`

## Affected routes

- `/interactive-learning/resources/lesson13-cruise-bridge` with a valid adaptive path launch context.
- `/assessment/adaptive-practice?goal=control-correction` after using `返回学习路径`.

## Verified flow

The browser opened the resource page with `source=adaptive-path-center`, a valid `pathId` and `nodeId`, and `intent=path-execution`. A deterministic blocked-journey fixture supplied a recovery action pointing to the original execution URL so the review regression was exercised directly.

Desktop 1440×1100 and mobile 320×1200 both verified:

- exactly one visible `返回学习路径` action;
- no duplicate `恢复学习路径` action;
- the visible return href is `/assessment/adaptive-practice?goal=control-correction`;
- clicking the action lands at the same goal-only URL;
- `pathId`, `nodeId`, execution intent, and candidate-batch parameters are absent after return;
- no horizontal overflow, failed HTTP responses, or browser console errors.

The resource body and unauthenticated AI conversation list are deterministic browser fixtures. Journey-control rendering, action deduplication, the visible return href, click navigation, and the path-center landing are production code from the bound source revision.

## Provenance

`return-flow-evidence.json` records:

- Git commit and tree SHA;
- the running development service revision proof;
- source file Git blob IDs and SHA-256 hashes;
- viewport assertions, final URLs, HTTP failures, and console errors;
- screenshot SHA-256 hashes.

The capture fails closed when the repository is dirty, the running service does not match the checkout, or relevant source files change during capture.

## Authoritative captures

- `resource-desktop.png` — SHA-256 `8e00ec132a413dd0cd453ea2032f7f99971d09fa30b89b0fbefcfafb5a2403ea`
- `resource-mobile-320.png` — SHA-256 `5bc5af8e968da48a03925580e062a24aa9b383aaabfa2b7a5022a9e2d3c56d00`
- `center-after-return-desktop.png` — SHA-256 `6bf1eb09ec67872ab2aa35558c0452d181be917c1d3aa7850ccb2f6a8348730f`
- `center-after-return-mobile-320.png` — SHA-256 `047b28345a8a9eae047798e2319b7c9a86c2d09d11a66e4038d1fc54b0ddf611`
- `return-flow-evidence.json`
