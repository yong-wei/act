# Proposal: issue-2082-link-path-resource-evidence

映射 GitHub Issue: #2082「路径内资源学习事件未关联路径执行，证据无法反馈下一轮个性化」。

## Why

路径启动链接携带完整上下文（`buildAdaptivePathLaunchHref` 写入 pathId/goalId/nodeId 等八参数，`adaptive-learning-center-contracts.ts:559-583`），但互动追踪链路没有路径归属通道（`useResourceInteractionTracking.ts:10-25`），事件落入 `standalone_resource`；服务端 governed evidence resolver 不覆盖 quiz 类型，执行记录 `evidenceRefs` 恒为 `[]`；simulation/control_workbench 节点连通用完成写路都未从资源页接通（服务端 resolver 存在但无客户端接线）。结果：路径内的可评分学习结果（如 100 分测验）不形成关联路径执行的受治理证据，下一轮候选路径无法消费。Issue 报告经代码核查确认属实（一处细化：仿真类比「证据为空」更严重，写路根本未接通）。

## What Changes

- 路径启动上下文透传进互动追踪载荷：路径内可评分测验与规范仿真事件携带 pathId、goalId、nodeId 与资源身份；服务端复用既有节点成员与 resourceType 校验，不直接信任客户端声明。
- quiz/lesson_step 完成时向对应 LearningPathExecution 写入最小必要的受治理 evidenceRefs（含分数与来源引用），路径中心可追溯。
- 接通 simulation/control_workbench 节点的路径内完成写路，复用服务端既有 governed resolver 与 SimulationRun 校验，禁止自报完成。
- 保持独立打开资源的 `standalone_resource` 语义不变（遵守 2026-09-03 归档决策）；页面浏览、视频停留、未评分完成不得提升为能力证据。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `adaptive-learning-path-planning`: 修改需求「Path-launched resources write completion through the path execution contract」——可评分路径内事件 SHALL 写入携带路径归属的受治理 evidenceRefs；simulation/control_workbench 写路必须真实接通。
- `interactive-governance-evidence`: 新增需求——路径内可评分事件携带路径/目标/节点归属并物化为受治理证据；独立资源保持 standalone 语义。

## Impact

- 代码：`useResourceInteractionTracking.ts`、`resources/[id]/page.tsx`、`api/learning-paths/[id]/execute/route.ts`（quiz resolver 与 evidenceRefs）、`interactive-event-ingestion.ts`（归属上下文）、control-workbench 页（路径参数解析）。
- 数据：`LearningPathExecution.evidenceRefs` 为既有列，无 Prisma 迁移。
- 依赖关系：本 change 只做埋点、路径关联与 evidenceRefs 写入；「下一批候选路径消费新证据并解释推荐依据」依赖 #2080/#2081 的画像读取修复，建议拆为后续 change（与 `explain-active-path-node-decisions` 的 #1186 三阶段衔接）。Issue 本体亦声明 #2080/#2081 用于验证画像消费、本 Issue 可并行实现。
- 非目标：不改变既有 governed resolver 的校验规则；不引入新的事件类型枚举值以外的分类重写；教师预览不写入任何学生状态。
