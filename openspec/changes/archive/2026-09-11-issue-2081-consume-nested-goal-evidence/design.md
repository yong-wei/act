# Design: issue-2081-consume-nested-goal-evidence

## Context

- 写入侧：`buildAssessmentLearningEvent`（`adaptive-persistence.ts:874-958`）产出 `kaqQuizEvidence.learningGoalIds`，事件 `courseId`/`moduleId` 固定为 `'adaptive-assessment'`，无顶层 `goalId`；物化落库嵌套在 `contextJson.adaptiveAssessment.kaqQuizEvidence` 下（`learning-fact-materialization.ts:420-453`）。
- 读取侧：`isControlCorrectionFact` 与内存目标匹配只读 `context.goalId / goal / targetGoal / learningGoal`（`evidence-match.ts:8-16`）；`buildExplicitControlCorrectionLearningFactWhere` 只查这 4 个顶层路径；legacy where 依赖课程/任务标识（`mappings.ts:9-14`），`adaptive-assessment` 不在其中。
- 治理过滤：`isLearningFactEligibleForPersonalization`（`learning-fact-quality-weight.ts:260-263`）已在插件读取链（`db-evidence.ts:81-83`）兜底，要求审核态、学习目标集合、版本引用、评分语义齐备。
- 对照：冷启动收集器已消费同一嵌套路径（`cold-start-evidence-collection.ts:544-549`），规则可复用。

## Goals / Non-Goals

**Goals:**

- 合格正式测评事实（嵌套 `learningGoalIds` 含控制校正目标）进入目标证据切片，画像维度 evidenceCount 非零。
- DB 查询与内存匹配使用同一归属规则，测试锁定一致性。
- 推荐依据可追溯到最小必要的学生安全证据引用。

**Non-Goals:**

- 不改变治理合格性过滤（未审核、缺版本/评分语义的事实继续被拒绝）。
- 不引入关键词猜测式归属（遵守 `docs/memory/02-recent-summary.md` 的 canonical scope 原则）；仅消费治理内 canonical 字段。
- 不调整九个维度定义与计数逻辑本身。

## Decisions

1. **归属语义：包含即归属 + 显式冲突拒绝**。嵌套 `learningGoalIds` 数组包含控制校正目标即归入该目标切片；若事实同时携带与控制校正冲突的顶层显式目标，则拒绝（维持既有严格语义，满足「不放宽无目标或非控制校正事实」）。
2. **DB 与内存同规则**：`buildExplicitControlCorrectionLearningFactWhere` 增加 `contextJson` 路径 + `array_contains` 条件（先例：`remediation-orchestration.ts:846`）；内存匹配读取同一嵌套路径。两条规则由同一常量/函数导出，测试双端断言。
3. **治理过滤顺序不变**：先归属、后合格性过滤；未审核或缺版本/评分语义的事实即使目标匹配也不进入切片。
4. **回归测试断言规则而非账号数值**：Issue 中 33/25 为生产数据观测，测试以构造事实断言归属规则、维度计数非零与能力目标 refs 非空。

## Risks / Trade-offs

- 风险：`array_contains` JSON 查询在部分 Prisma/Postgres 组合上的索引利用差。缓解：归属查询仍受学生与治理条件约束，结果集小；必要时以既有查询模式为准。
- 权衡：选择「包含即归属」而非「全部相等」会纳入多目标事实；该语义与冷启动收集器一致，且由显式冲突拒绝兜底。
