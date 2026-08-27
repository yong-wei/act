## Context

`recommendation-engine.ts` 约 1703 行，直接导入 Prisma、读取混合 learner state，并同时处理候选、解释、用户范围和持久化。`intervention-engine.ts` 与 AI routes 维护另一个决策生命周期；assessment remediation、micro-tutoring 和 worker 重试又可能绕过同一证据规则。canonical contracts 已区分 Learning Record 的事实 authority、Assessment 的评分 authority 和 Personalization 的策略 authority，本 change 负责把实际调用链收敛到该边界。

## Decisions

### Personalization owns policy

公开 use cases 为 `RecommendLearning` 与 `DecideIntervention`。它们只消费 learner-state reducer、Learning Record read ports、Assessment/Arena/simulation validation ports、路径规划结果和 course plugin policy；不直接访问 Prisma、原始答案、事件载荷或 Next/React。

推荐输出沿用现有可兼容字段，但必须带受治理 rationale、provenance、confidence、privacy class、owner scope 和 policy/revision。推荐是软建议，不能创建 mastery、readiness、path eligibility 或权限。

### Learning Record owns facts

Learning Record 公开事实读端口和事件/事实写端口，负责 LearningFact、snapshot、watermark、去重和隐私投影；它不实现候选排序、干预策略或路径组装。Personalization 通过 ports 请求写入决策/结果，不把策略代码藏入 data-governance repository。

### Cross-process evidence projection

需要跨进程投影的微干预必须复用现有 `EvidenceOutbox → worker → LearningFact` 协议。`DecideIntervention` 的决策事务通过 Learning Record port 同时提交决策/受治理 outcome 与一个唯一 outbox row；row 绑定服务器生成的稳定 `actionId`、`causationId`、dedupe identity、subject scope、source revision、privacy-safe projection 和 policy/evidence refs。不得在同一 producer path 直接写 LearningFact 再写 outbox，也不得由两个 producer 同时物化。

outbox 及其 worker 状态必须可审计地表达 `staged → deduplicated → applied`（或同等明确状态）。worker 是这条跨进程路径唯一的 LearningFact materializer，按 dedupe/causation 约束 claim、物化和标记 applied；崩溃、重试或重复投递只能返回既有 applied 结果，不能产生第二个 Fact。没有对应 outbox row 的决策只能报告 pending/unavailable，不能声称 learner profile 已刷新。outbox receipt 和公开 Fact 只包含 privacy-safe 投影，raw answer、prompt、模型原文和用户标识不得进入其中。

Assessment 若在同一事务内同步完成官方评分并写入其 canonical fact，则继续使用该 Assessment 直接写路径，不为本 change 强制事件化。Arena 正式成绩仍由 Arena evaluator 负责，本 change 不重写其 authority 或成绩。

### Intervention lifecycle and evidence

干预状态为 `decision → started/used → completed`，事件类型只允许 `RESOURCE_USED`、`HINT_REQUESTED`、`COMPLETED`，每个事件携带服务器生成的 decision/intervention identity、owner、source revision 和幂等键。跨进程事件按上述 outbox 协议投影；浏览页面、打开提示、普通 prompt 或模型文本不产生 mastery evidence；完成事件只有在独立验证的 Assessment、Arena 或 simulation contribution 存在时，才可由对应 authority 产生可晋级事实。

### Migration and deletion

先对 recommendation、intervention、remediation、worker 和 profile/AI callers 做 characterization，再实现 ports/use cases，逐个迁移到公开 contract。响应适配只允许位于 route/worker 边缘。调用者归零、导入图证明旧 engine 无生产消费者、策略/隐私/幂等测试通过后，删除旧 engine public exports 和 re-exports；事实表与其他领域 adapter 按 owner ledger 决定保留。

## Risks and mitigations

- recommendation 重复或 worker 重试：用稳定 decision/event identity、outbox `actionId`/`causationId`/dedupe identity 和数据库唯一约束做幂等，重复返回原结果。
- 干预事件越权升级 mastery：白名单事件、独立验证 port 和 mastery contract 测试阻断。
- 用户范围或教师数据泄露：服务器派生 owner scope，输出使用 privacy projection，禁止原始 payload。
- producer crash 或 direct+outbox 双写：事务内只 staging 一个 outbox，worker 独占 LearningFact 物化，以 crash-replay 和 direct+outbox 负例验证不会双计。
- 迁移造成策略漂移：保留 characterization fixtures，逐项比较排序、理由、confidence、revision 和失败关闭结果。
