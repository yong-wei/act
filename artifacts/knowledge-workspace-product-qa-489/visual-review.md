# /knowledge Visual Review

## UI Result

PASS.

This read-only review used the current browser evidence and PNG artifacts under `artifacts/knowledge-workspace-product-qa-489/`. The review result is bound in `browser-evidence.json` through `independentVisualReview.reviewedStateSha256` and `independentVisualReview.reviewedSourceSha256`; later screenshot or source changes cannot reuse this PASS without matching the reviewed hashes.

This pass was refreshed after the Konling runtime fix that keeps degraded requested-node contexts unresolved instead of upgrading `requestedNodeId` to a selected node. The refreshed `desktop-konling-degraded-dark.png` evidence still shows the unresolved request state rather than selected-node context.

## Blocking Findings

None.

The current Konling screenshots show the global assistant sidebar, not the theme/settings menu. The selected/no-selection/degraded contexts are visibly distinct and match the recorded markers:

- `desktop-konling-selected-expanded-dark.png`: selected-node context with `z反变换_7_7959c077`.
- `desktop-konling-no-selection-dark.png`: no-selection context.
- `desktop-konling-degraded-dark.png`: degraded unresolved-node context for `missing-node`.
- `mobile-320-konling-expanded-dark.png`: mobile assistant sidebar with selected-node context and no local-tool or inspector overlap.

## Review Dimensions

- `handoffAlignment`: PASS
- `conceptAdoptionRejection`: PASS
- `appShellContinuity`: PASS
- `localTools`: PASS
- `semanticMap`: PASS
- `inspectorHierarchy`: PASS
- `konlingDock`: PASS
- `interactionStability`: PASS
- `keyboardFocus`: PASS
- `themeParity`: PASS
- `mobileBehavior`: PASS
- `stressNonOverlap`: PASS

## Notes

The latest evidence includes Playwright focus probes for desktop local tools, mobile local sheet, mobile inspector, and Konling expanded sidebar. Each probe validates focus entry, keyboard reachability, and Escape or close-trigger return behavior.

The QA-only Konling entry is now gated behind non-production runtime, the `/knowledge` path, the explicit `qa=knowledge-product` query, and the capture-script localStorage marker. Manual URL query alone does not expose the assistant entry when `shouldShowButton` is false.
