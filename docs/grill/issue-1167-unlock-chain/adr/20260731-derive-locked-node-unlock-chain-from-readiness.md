# 锁定节点解锁链路由展示层从现有 readiness 派生，不扩展持久化契约

Issue #1167 的锁定节点只展示结果状态或单条 `unlockMessage`，不足以让学生知道“为什么锁、缺什么、下一步做什么”。Planner 已提供 `requiredCompletedNodeIds`、`missingCompletedNodeIds`、`missingEvidenceCount`、`missingCompetencies`、`missingOutcomeRefs`、`fallbackNodeIds`，因此本次不再建设全局进度图，也不改变 Planner 生成逻辑或持久化路径 payload。

学生端解锁链路统一由展示层从现有 `pathPlan.mainPath[].readiness` 派生，并在路径选项预览与已选路径执行时间线/节点详情中展示。缺字段时按 `fallbackNodeIds` / `prerequisiteNodeIds` / `unlockMessage` 的顺序降级，仍无具体信息时明确说明“暂时无法展示具体解锁条件”，不编造链路。该决策接受旧记录可能只有降级文案的代价，以换取最小范围、无数据迁移和避免历史 payload 失效。
