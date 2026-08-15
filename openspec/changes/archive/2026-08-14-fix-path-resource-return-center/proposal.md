## Why

资源页的“返回学习路径”当前可能保留路径执行参数，导致用户返回后仍停留在资源执行工作区，无法重新看到“继续原路径”和“新建学习路径”的中心入口。Issue #1386 已确认返回语义应回到路径中心，同时保留学习目标并让中心恢复已保存路径。

## What Changes

- 将从有效路径上下文打开的资源页返回动作定义为回到学习路径中心入口。
- 返回时保留学习目标，清除路径执行、节点和候选批次参数。
- 在路径中心由用户明确选择“继续原路径”后恢复已保存路径；只有选择“新建学习路径”才进入候选路径生成与比较。
- 将该导航语义记录为 OpenSpec 合同，并补充桌面与 320px 浏览器验收证据。

## Capabilities

### New Capabilities

<!-- None. This change clarifies and updates an existing capability. -->

### Modified Capabilities

- `adaptive-learning-center-ui`: 修改路径资源返回控制的目标，从直接恢复执行工作区改为返回路径中心入口，由中心负责继续原路径或新建路径。

## Impact

- `src/features/adaptive/adaptive-path/adaptive-path-journey-control.tsx` 及其测试。
- 自适应学习中心的路径返回 OpenSpec 合同。
- 不引入数据库、API 或依赖变更；已保存路径数据和资源完成回写保持不变。
