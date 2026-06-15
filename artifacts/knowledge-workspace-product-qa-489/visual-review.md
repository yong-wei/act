# /knowledge Visual Review

## UI Result

PASS.

本轮复核由 `ui-flow-reviewer:019ecb20-d6ae-75a0-a83e-9ea2e4741139` 基于当前 `artifacts/knowledge-workspace-product-qa-489/` 下的 15 张截图与 `browser-evidence.json` 完成。审查结果通过 `independentVisualReview.reviewedStateSha256` 与 `independentVisualReview.reviewedSourceSha256` 绑定当前截图和源码哈希；后续截图、生产源码、采集脚本或治理脚本变化都不能复用本次 PASS。

This pass was refreshed after the Konling runtime fix that keeps degraded requested-node contexts unresolved instead of upgrading `requestedNodeId` to a selected node. The refreshed `desktop-konling-degraded-dark.png` evidence still shows the unresolved request state rather than selected-node context.

## Blocking Findings

None.

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

目标截图与 `browser-evidence.json` 一致：AppShell、局部工具、语义图谱、stable inspector 与共享 Konling dock 已形成统一产品壳层；Konling 选中态、未选中态、degraded 态区分清楚，`missing-node` 不再误显示为 selected-node。

The QA-only Konling entry is now gated behind non-production runtime, the `/knowledge` path, the explicit `qa=knowledge-product` query, and the capture-script localStorage marker. Manual URL query alone does not expose the assistant entry when `shouldShowButton` is false.

压力态下 `expandedDock` 位于 `left=564 right=984`，`inspector` 位于 `left=984 right=1416`，两者贴边不重叠；`desktopTools.bottom=101` 到 dock `top=112` 保留间隙，`konlingInspectorAvoidance=active` 与图面一致。

四项键盘焦点探针全部通过。320px 移动端展开态未见遮挡或交互回退。
