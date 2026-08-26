## Why

Planner 会把尚未 ready 的 Arena 终点留在路径里，但 `terminalValidationStrategy.summary` 仍写成 `terminal validation through …`，`paths[].limitations` 也不说明终点当前不可验证。cold-start / `NO_EVIDENCE` 学习者会误以为终点已经可以检验。Issue #1538。

## What Changes

- 当 `terminalValidationNodeIds` 非空且这些终点没有一个 `ready` 时，报告“终点已纳入但当前不可验证”。
- 同步更新 `terminalValidationStrategy.summary` 与 `paths[].limitations`。
- 保留现有路径结构、active/locked 截断和 ready Arena 对照行为。

## Non-goals

- 不改候选选择、路径结构和执行行为。
- 不改 `fallbackReasons`、`plan.status`、`studentFacing` 与 bundle 状态语义。
- 不新增 schema 或 API 字段。
- 不回退 #1540 对不可满足终点的官方候选筛选。

## Capabilities

### Modified Capabilities

- `adaptive-learning-path-planning`: 对已纳入但未 ready 的终点给出明确报告。

## Impact

- 修改 Planner 报告层与相关单元测试。
- 学生可见 limitations 映射保持同一文案。
