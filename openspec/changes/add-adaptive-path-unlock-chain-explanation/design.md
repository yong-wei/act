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

### 收尾证据裁决（PR #1169）

当前页面修订进入 PR 后，商业 UI 门禁要求 adaptive-path 产品 QA 工件晚于该页面的最后源代码变更。仅重新生成汇总 JSON 会更新哈希而不会重新验证视觉状态，不能作为证据刷新。

因此，收尾必须在最终页面修订上重新采集完整的 13 个 adaptive-path 产品 QA 状态，并由独立审查确认新截图和交互状态；随后再生成汇总工件。`/knowledge` 产品 QA 的独立证据漂移属于 `integration` 基线，不属于本变更的功能实现。为使 #1169 能在完整门禁下收尾，必须先由独立基线修复 PR 修复正式 adaptive-path 捕获合同；该 PR 不得更新会因 #1169 的页面变更立即失效的产品证据。#1169 随后以 merge 方式同步 integration，并在组合后的最终 HEAD 一次性真实重采 adaptive-path 与 `/knowledge` 两组证据。两项修复均不得放宽门禁、替换摘要或复用不同修订上的截图。

### 解锁动作的启动合同（PR #1169 P1 修复）

解锁链路只负责解释锁定条件和标识下一步节点，不以 readiness 中的原始 `target` 授权导航。已选路径的动作必须由既有 journey/path-center 投影解析，并复用已有启动合同：内部目标带入 `goalId`、`pathId`、`nodeId` 与返回上下文；外部资源保持 execute POST、重定向和完成确认。

候选预览尚无权威 `pathId`，不得启动资源或伪造执行上下文。它仍展示相同的解锁链路，但只提供既有路径选择/创建动作；不存在这种受治理动作时显示文本。无法唯一解析、已锁定、已阻断或过期的动作一律降级为文本。

当前 learning-center projection 仅公开唯一的 `nextAction`，未提供任意节点的 action 列表。因此，执行时间线只在解锁链的 `nodeId` 与该 `nextAction.nodeId` 严格相等、且 action 通过既有可用性判断时显示动作；点击直接复用完整投影 action。GET 使用投影 `href`，POST 复用 `href`、`body`、`redirectHref` 与完成合同。本地执行节点、链路标题和原始目标均不得补推导授权。

### 基线门禁依赖的提交边界（PR #1169 收尾）

独立基线 PR 只修复共享 adaptive-path 捕获合同及其测试。它不得包含 #1167 的解锁链路行为，也不得提交 `/knowledge` 或 adaptive-path 的产品证据，因为 `/knowledge` 矩阵跟踪 adaptive-practice 页面。#1169 仅在该 PR 合并后使用非改写 merge 同步 integration，再在自己的最终组合 HEAD 上重采 `/knowledge` 与 adaptive-path 的全部受影响状态。完整 `npm run test` 与 current-HEAD 审查均以该最终组合 HEAD 为准。

## Risks / Trade-offs

- [旧路径记录缺少结构化 readiness] → 按降级策略展示 `unlockMessage` 或明确不可解释文案，不伪造链路。
- [缺失节点 ID 不在当前路径中] → 优先显示已有标题；无标题时使用通用条件描述，不暴露内部 ID。
- [缺失条件过多导致界面拥挤] → 只展示未满足条件，并按“完成节点 -> 结果/证据 -> 能力”排序，必要时限制可见条数。
