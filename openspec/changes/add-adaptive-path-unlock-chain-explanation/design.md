## Context

当前学习路径中的锁定节点只展示“稍后解锁”或单条 `unlockMessage`。Planner 在 `AdaptiveLearningPathNode.readiness` 中已经保留 `missingCompletedNodeIds`、`missingEvidenceCount`、`missingCompetencies`、`missingOutcomeRefs`、`fallbackNodeIds`，但路径选项预览和执行时间线都没有把这些字段转换为学生可见的解锁链路。

## Goals / Non-Goals

**Goals:**
- 在路径选项预览与已选路径执行时间线/节点详情中展示同一套解锁链路。
- 解锁链路由现有 `pathPlan.mainPath[].readiness` 派生，覆盖“为什么锁、缺什么、下一步做什么”。
- 缺字段时按既定优先级降级，不编造具体解锁条件。

**Non-Goals:**
- 不新增完整全局进度图或前置依赖图。
- 不改变 Planner 生成逻辑、路径排序或 readiness 计算。
- 不扩展持久化路径 payload 或数据库结构。

## Decisions

### 新增纯展示层解锁链路函数

新增 `src/lib/adaptive-path-unlock-chain.ts`，输入锁定节点及当前路径上下文，输出学生安全的结构化视图：

- `reason`: 面向学生的锁定原因。
- `missingConditions`: 当前未满足的条件列表，包含条件类型、标题/描述、当前值与要求值（可用时）。
- `nextAction`: 下一步解锁动作，优先指向缺失完成节点或 fallback/prerequisite 节点的可执行目标；无目标时仅提供文本。

路径选项预览和执行时间线共用该函数，避免两套口径。

### 优先使用已有 readiness 字段

派生顺序为：

1. `missingCompletedNodeIds`：映射为路径内节点标题；未知 ID 不暴露原始 ID。
2. `missingOutcomeRefs`：展示为“指定结果尚未同步/未通过”。
3. `missingEvidenceCount`：展示为“还缺 N 条可复核学习证据”。
4. `missingCompetencies`：结合 `minimumCompetency` 展示能力缺口，不暴露内部维度 ID。

### 路径选项预览从完整 plan 派生

`buildPathOptionSummaries` 或等价视图构建层在生成选项预览时，从 `pathPlan.mainPath` 查找锁定节点并补充解锁链路。展示层改动不改变序列化选项的持久化格式；历史 payload 缺少结构字段时走降级。

### 执行时间线增加解锁链路字段

`PathExecutionNodeView` 增加可选 `unlockChain`。锁定节点展开详情展示“锁定原因 / 缺失条件 / 下一步动作”，锁定操作区在无可用目标时只显示文本，有目标时显示跳转动作。

### 降级策略

优先级为：

1. 结构化解锁缺口；
2. `fallbackNodeIds` / `prerequisiteNodeIds`；
3. 作者配置的 `unlockMessage`；
4. 明确展示“暂时无法展示具体解锁条件”，不退回无意义的“稍后解锁”作为唯一说明。

## Risks / Trade-offs

- [旧路径记录缺少结构化 readiness] → 按降级策略展示 `unlockMessage` 或明确不可解释文案，不伪造链路。
- [缺失节点 ID 不在当前路径中] → 优先显示已有标题；无标题时使用通用条件描述，不暴露内部 ID。
- [缺失条件过多导致界面拥挤] → 只展示未满足条件，并按“完成节点 -> 结果/证据 -> 能力”排序，必要时限制可见条数。
