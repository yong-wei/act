# Design: issue-2014

## 根因模型

`readLatestGovernedFactAt(db, userId)` 用 `learningFact.findFirst({ where: { userId }, orderBy: startedAt desc })` 取最新事实时间；`readStudentEvidencePort`/`readTeacherClassEvidencePort` 用 `isNewerGovernedFact(portrait.evidenceAsOf, latestFactAt)` 判断 qualified 画像是否 `newer-learning-fact` 过期。该查询不区分事实的治理状态：时间较新但已被 REVOKE 的事实同样参与比较，导致画像被误标 stale、教师班级覆盖人数误降（121→82）。

`LearnerFactTransition` 按 `(userId, sequence)` 唯一、按 factId 关联事实，operation ∈ UPSERT|CORRECT|REVOKE；每个事实的最终有效状态由其最大 sequence 的 transition 决定。

## Decisions

1. **以「最终操作 ≠ REVOKE」定义有效事实。** 先用 `learnerFactTransition.findMany({ where: { userId }, orderBy: [{ factId: 'asc' }, { sequence: 'desc' }], distinct: ['factId'] })` 取每事实最新 transition，收集最终 REVOKE 的 factId；`learningFact.findFirst` 以 `id: { notIn: revokedFactIds }` 排除。选 notIn 而非 in-active：无 transition 的历史事实不会被误判无效（避免同类覆盖误降）。
2. **db 最小接口容错。** `learnerFactTransition.findMany` 不存在时返回空 revoked 集合，查询退化为现状——现有消费者 mock 与窄 db 注入不受影响。
3. **保护语义保持。** 较新有效事实仍触发 `newer-learning-fact`；`isProcessingAheadOfState` 水位保护不变；`isNewerGovernedFact` 比较逻辑不变。

## 测试策略

- 新增：最终 REVOKE 的较新事实 → 画像保持 qualified（不 stale）。
- 新增：最终 UPSERT 的较新事实 → 仍 stale（保护保留）。
- 新增：同一 factId REVOKED 后另一 factId 有更新有效事实 → 按有效事实时间比较。
- 既有 mock 不含 learnerFactTransition 的用例维持通过（容错路径）。
