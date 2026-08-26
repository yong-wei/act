## Context

路径选项已经区分 `activeNodeIds` 与 `lockedNodeIds`。#1540 不再把仅被 competency/evidence 锁住、且无法通过路径完成项解锁的 Arena 作为官方终点。仍可能留下带 `requiredCompletedNodeIds` / `requiredOutcomeRefs` 的 locked 终点。当前 summary 不区分“已纳入可验证”和“已纳入但未 ready”。

## Goals / Non-Goals

**Goals:**

- 触发条件：`terminalValidationNodeIds` 非空，且这些节点没有一个 ready。
- summary 与 limitations 使用稳定文案“终点已纳入但当前不可验证”。
- ready Arena 对照保持 `terminal validation through …`。

**Non-Goals:**

- 不改候选装配、官方终点筛选、fallback 状态或执行解锁。

## Decisions

1. ready 判定使用路径节点 `status !== 'locked'|'blocked'` 且 `readiness.state === 'ready'`（缺省视为 ready）。
2. 报告层集中在 `buildTerminalValidationStrategy` / `buildPathOptionLimitations`，policy bundle 与 serializable options 共用。
3. 学生可见映射把同一文案原样投影，避免变成“路径状态待确认”。

## Risks / Trade-offs

- 与 #1540 并存：不可满足终点仍不是官方候选；本变更只报告仍然纳入且未 ready 的终点。
