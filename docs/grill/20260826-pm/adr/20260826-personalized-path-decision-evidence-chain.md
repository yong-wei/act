# ADR: 个性化路径决策证据链

- 日期: 2026-08-26
- 状态: accepted
- Issue: #1561

## Context

PR #1528、#1530、#1533 已完成候选比较、画像消费和继续/新建分流。推荐依据摘要仍不能证明哪些画像事实造成了哪些路径差异，也不能防止刷新后解释漂移。

## Decision

在候选批次生成时冻结 `personalized-path-decision-evidence.v1`。快照写入 bundle 与每条候选 snapshot。候选影响相对同批次其他路径计算，并区分 `profile` / `rule` / `constraint` / `degraded`。解释同时保存 code 和 studentText；前端不重算。

## Consequences

历史批次的解释保持生成时语义。新的画像只影响新建批次。不引入排名，不改继续原路径行为。
