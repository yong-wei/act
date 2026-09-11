# Proposal: issue-2081-consume-nested-goal-evidence

映射 GitHub Issue: #2081「控制校正画像未消费正式测评的嵌套学习目标证据」。

## Why

正式自适应测评把学习目标以嵌套形式写入 LearningFact（`contextJson.adaptiveAssessment.kaqQuizEvidence.learningGoalIds`，见 `learning-fact-materialization.ts:420-453`），不提供顶层 `goalId`；而控制校正插件的证据归属只识别 4 个顶层目标字段（`evidence-match.ts:8-16`）加 legacy 课程/任务匹配，其 `courseId='adaptive-assessment'` 两条路径均不命中。漏配发生在数据库查询层（`buildExplicitControlCorrectionLearningFactWhere`，`evidence-match.ts:78-88`），插件对该类合格事实返回 0 条，九个控制校正维度 evidenceCount 全为 0。对照证据：冷启动收集器（`cold-start-evidence-collection.ts:544-549`）已消费同一嵌套路径，证明这是插件专属缺口。Issue 报告经代码核查确认属实。

## What Changes

- 控制校正插件的证据归属规则扩展：消费治理内嵌套路径 `adaptiveAssessment.kaqQuizEvidence.learningGoalIds`，将合格正式测评事实归入对应学习目标的控制校正证据切片。
- 数据库查询构造与内存匹配使用同一套目标归属规则；对无学习目标、无审核、版本不一致或目标不匹配的事实维持拒绝。
- 补充回归测试：内存匹配、where 构造、画像维度计数非零、能力目标证据引用非空，以及四条拒绝路径。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `control-correction-personalization-plugin`: 新增需求——插件 SHALL 消费正式测评嵌套学习目标集合作为控制校正证据归属来源，DB 查询与内存匹配规则一致，且不放宽既有治理拒绝边界。

## Impact

- 代码：`src/features/personalization/plugins/control-correction/evidence-match.ts`（归属规则与 where 构造）、相关 learner-state 测试。
- 无 Prisma schema 迁移（`contextJson` 路径查询已有先例 `remediation-orchestration.ts:846`）。
- 依赖关系：与进行中 change `guard-client-competency-contribution` 同触 `learning-fact-quality-weight` 邻域，实施时需 rebase 感知；与进行中的课程 Runtime 发布及 v040 内容切换无依赖（回归测试断言归属规则而非具体事实数量）。
- 非目标：不改变 `isLearningFactEligibleForPersonalization` 治理过滤；不扩展控制校正之外的插件归属。
