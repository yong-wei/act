# Design: issue-2082-link-path-resource-evidence

## Context

- 启动侧：`buildAdaptivePathLaunchHref` 写入 `source/goal/goalId/pathId/nodeId/intent/returnHref/resourceType`（`adaptive-learning-center-contracts.ts:559-583`）；资源页解析返回上下文（`resources/[id]/page.tsx:32`）。
- 断点 1：追踪 Hook 选项无 pathId/goalId/nodeId 通道（`useResourceInteractionTracking.ts:10-25`），`baseData` 只记 `originPath: pathname`（不含 query），路径参数在事件源头被丢弃；`LearningContext` 枚举（`interactive-event-ingestion.ts:21-26`）无「路径内」类别。
- 断点 2：路径启动的资源页不传 `sessionId`（`page.tsx:227-231`），事件落入 `standalone_resource`；`assessment_complete`/`simulation_finish` 物化为独立 LearningFact，`contextJson` 仅在载荷自带 `goalId` 时透传（`learning-fact-materialization.ts:538`）。
- 断点 3：execute 路由默认 `evidenceRefs: body.evidenceRefs ?? []`（`route.ts:234`），资源页只传 `completionResult`（`page.tsx:141-145`）；governed resolver 覆盖 knowledge_card/lesson_step/assessment/simulation/control_workbench/arena，**唯独没有 quiz**——100 分测验的 evidenceRefs 恒为 `[]`，分数仅以自报 `liftMetadata.completionResult` 留存。
- 断点 4：`isSimpleAdaptivePathCompletionResource` 不含 simulation/control_workbench（`contracts.ts:619-635`），通用完成请求返回 null 后页面抛错；control-workbench 页不解析路径参数（`control-workbench/page.tsx:13-21`）。服务端 `resolveGovernedSimulationOutcomeEvidence`/`resolveGovernedControlWorkbenchOutcomeEvidence` 存在但无客户端接线。
- 边界：standalone_resource 语义是 2026-09-03 归档变更的既定设计；ADR 明确「浏览/参与不得视为掌握」。

## Goals / Non-Goals

**Goals:**

- 路径内可评分事件携带 pathId/goalId/nodeId/资源身份，并被物化为带路径归属的受治理证据。
- quiz/lesson_step 完成写入 LearningPathExecution 的最小受治理 evidenceRefs，路径中心可追溯。
- simulation/control_workbench 节点完成写路真实接通，走服务端 governed 校验。
- 下一轮候选路径可引用新增证据（消费与解释拆后续 change）。

**Non-Goals:**

- 不改变 standalone_resource 分类语义，独立打开资源不得伪造路径归属。
- 不把页面浏览、视频停留、未评分完成提升为能力证据。
- 不实现「下一批候选路径消费与推荐解释」（依赖 #2080/#2081，后续 change）。
- 教师预览不写入学生状态或证据。

## Decisions

1. **客户端透传 + 服务端权威校验**：资源页把已解析的路径启动上下文写入事件载荷；服务端 execute 与物化链复用既有节点成员/resourceType 校验（`route.ts:108-122`），客户端声明仅作线索，不作授权依据。
2. **归属记录不新增 LearningContext 枚举值**：路径归属作为事件的附加上下文字段（pathId/goalId/nodeId）随载荷流动，standalone 分类逻辑不变；独立打开资源无这些字段，自然保持 standalone。
3. **quiz governed resolver 对齐既有模式**：为 quiz 增加与 lesson_step 同构的服务端 resolver，产出 `sourceLogId/clientEventId + completionResult` 的最小 evidenceRefs，写入对应 LearningPathExecution。
4. **仿真/工作台接通复用既有 resolver**：客户端按复杂节点写路提交，服务端 `resolveGovernedSimulationOutcomeEvidence`/`resolveGovernedControlWorkbenchOutcomeEvidence` 已做 SimulationRun 校验；禁止自报完成。
5. **幂等**：完成写入沿用既有 idempotency key 机制（`route.ts` 现状），重复提交不重复计数。

## Risks / Trade-offs

- 风险：路径参数经 URL 传递可被伪造。缓解：服务端节点成员与 resourceType 校验兜底，伪造声明无法通过校验，且不落证据。
- 风险：旧有路径内完成记录（无 evidenceRefs）不回填。说明：历史记录不回填，仅新事件生效；如需历史修复另立数据治理任务。
- 权衡：不新增 LearningContext 枚举避免分类重写，代价是「路径内」语义依赖归属字段存在性判断——由服务端统一判定，测试锁定。
