## Why

Assessment 已有 Prisma 持久化实现，但 `adaptive-engine.ts` 的 `globalThis`/`Map` 状态和 `ADAPTIVE_ASSESSMENT_PERSISTENCE_ENABLED=false` 回退仍然可达；`next-question` 与 `submit-answer` 还各自解析路径上下文。结果是同一条路径可能绕过 reviewed catalog、产生不可恢复的 session/item ref，或在重试与并发下形成不同的评分和 LearningFact。

## What Changes

- 建立 Assessment domain 的 public API、use case、read/write ports 和 Prisma adapters，唯一承载 path-owned 的 next-question 与 submit-answer 纵向链路。
- 将 `next-question → reviewed catalog → durable session/item ref` 和 `submit-answer → score/mastery → LearningFact` 迁入同一 Assessment application boundary；路径身份由服务器从授权的 `LearningPath` 派生。
- 为 session、asked history、catalog item snapshot、answer、评分/掌握度和 LearningFact 写入定义幂等、并发串行化、不可变快照和失败关闭语义。
- 迁移 diagnostic、ability report、profile、companion practice 及所有路径调用者，删除重复 path-context parser、Map 状态、持久化 flag fallback 和旧 Assessment public entry；不删除仍有消费者的 `Question`/`UserAnswer` 表。
- 保持既有响应兼容字段和学生隐私边界；临时 practice 也必须走明确的 Assessment policy，不能回到进程内权威状态。

## Capabilities

### New Capabilities

- `assessment-domain-attempts`: 定义 Assessment domain 的 path-owned public API、服务器派生身份、持久化 attempt、幂等并发和 adapter 边界。

### Modified Capabilities

- `adaptive-assessment-persistence`: 将“持久化可回退”收紧为唯一 durable authority，保留历史快照、LearningFact 和响应兼容语义。

## Dependencies

- 前置：`reconcile-reviewed-assessment-generation-governance`，以及已 qualified 的 `establish-modular-monolith-refactor-charter`、`enforce-modular-domain-dependency-contracts`。
- 消费前置提供的 reviewed catalog、generation kind、publication receipt 和阶段资格；不得自行创建 catalog 或 candidate schema。
- 下游：`reduce-personalization-learner-state` 只通过 Assessment read port 读取评估事实与掌握度输入；`retire-legacy-adaptive-entrypoints` 在全部调用者迁移后清场。

## Impact

- 影响 `src/features/assessment/adaptive-engine.ts`、`adaptive-persistence.ts`、`adaptive-attempt-context.ts`、`src/app/api/assessment/{next-question,submit-answer,diagnostic,ability-report}`、`src/app/api/user/profile/route.ts` 及路径/companion 调用者。
- 影响 Assessment 相关 Prisma repository/adapters、幂等与并发测试、LearningFact 物化授权；不改变仍服务其他领域的旧 `Question`/`UserAnswer` schema。
- 不新增生产 feature flag，不部署、不迁移生产数据、不激活生产 selector；迁移和回滚证据留在实现 change 的台账中。
