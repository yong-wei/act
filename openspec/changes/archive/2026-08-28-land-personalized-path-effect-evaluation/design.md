# Design: Land personalized path effect evaluation

## Context

决策证据已冻结在 candidate batch metadata 与 candidate snapshot 中。控制校正教师报告已有班级指标，但不绑定个性化决策快照，也不区分基准路径与低置信样本。

## Goals / Non-Goals

**Goals:**

- 只读评估记录可复现，刷新页面后不因当前画像漂移。
- 高置信个性化、基准和证据不足样本分列。
- 样本不足不得给出效果结论。
- 教师/管理员只看聚合与安全摘要。

**Non-Goals:**

- 不重写路径评分或候选生成。
- 不引入 contextual bandit、强化学习或系统排名。
- 不把路径选择直接写成 mastery。
- 不等待 `cutover-personalization-path-planner` 删除旧 planner；评估只消费已保存快照。

## Decisions

### 1. Snapshot-bound read model

Each evaluation row binds `goalId`, frozen `decisionEvidence.snapshot`, path identity/status, and execution records. Live learner state is ignored.

### 2. Cohort split

- `insufficient`: missing snapshot, low/none confidence, stale/partial freshness, or degradation reasons.
- `personalized`: trusted snapshot with at least one non-degraded impact.
- `baseline`: remaining adopted/generated paths for the same goal.

Comparisons require both personalized and baseline cohorts. Below `minSampleSize` (5), conclusion is `insufficient-data`.

### 3. Metrics stay observational

Adoption, completion, checkpoint completion, and competency lift are rates with explicit numerators/denominators. They do not update mastery, Arena scores, or saved paths.

## Risks / Trade-offs

- [Risk] 旧路径没有决策证据会全部进入 insufficient。→ 这是诚实降级，不是失败。
