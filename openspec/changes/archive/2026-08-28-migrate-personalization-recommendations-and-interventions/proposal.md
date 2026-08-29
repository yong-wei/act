## Why

推荐策略目前位于 `src/lib/data-governance/recommendation-engine.ts`，既直接读 Prisma，又读取混合的 learner-state service；AI intervention engine、student recommendations、assessment remediation/micro-tutoring 和 worker consumer 还分散维护策略与事实写入。这样会使 Learning Record 变成策略 owner，并可能把普通浏览、提示或模型叙述误计为 mastery。

## What Changes

- 让 Personalization 拥有 recommendation 与 intervention policy，公开 `RecommendLearning` 和 `DecideIntervention` application use cases；Learning Record 只通过 read/write ports 提供或记录受治理事实。
- 将 student recommendations、profile/AI consumers、intervention generate/check/feedback、assessment remediation/micro-tutoring 与 worker consumer 迁移到同一策略边界，并保留 rationale、confidence、provenance、privacy、owner scope、revision 和幂等语义。
- 将干预事件限制为 canonical 的 `RESOURCE_USED`、`HINT_REQUESTED`、`COMPLETED` 生命周期；普通浏览、提示请求或模型输出本身不授予 mastery，只有独立验证的 Assessment/Arena/simulation 贡献才可进入受治理证据链。
- 对需要跨进程投影的微干预，在干预决策事务中通过 Learning Record port 以稳定 `actionId`、`causationId` 和 dedupe identity 唯一 staging 一个现有 `EvidenceOutbox`；由 worker 作为该路径唯一的 LearningFact materializer，禁止同时直接写 Fact 和 outbox。
- 明确 `staged`/`deduplicated`/`applied`（或等价可审计状态）及 crash/retry/replay 语义；缺少 outbox 时不得伪称画像已刷新。已有同步、同事务的 Assessment fact 写入继续直接写，不强制事件化；Arena 正式成绩权威保持不变。
- 在调用者归零后删除 `src/lib/data-governance/recommendation-engine.ts` 和旧 intervention 策略公开入口，不保留 facade、转发或第二套 recommendation schema；保留仍由其他域负责的事实表和历史记录。

## Capabilities

### New Capabilities

- `personalization-recommendation-intervention-policy`: 定义 Personalization 推荐与微干预策略、Learning Record ports 和证据晋级边界。

### Modified Capabilities

- `evidence-driven-personalization`: 将推荐/干预策略归属 Personalization，并统一受治理事实、理由、隐私和置信度。
- `adaptive-mastery-state`: 收紧微干预事件不得自动提升 mastery，独立验证贡献仍由 Assessment/Arena 等权威负责。

## Dependencies

- 前置：`reduce-personalization-learner-state`、`externalize-control-correction-personalization-plugin`；如使用路径候选，依赖 `cutover-personalization-path-planner`，以及已 qualified 的 charter/dependency contracts。
- 复用 `evidence-driven-personalization`、`adaptive-mastery-state`、`micro-intervention-learning-evidence`、`micro-intervention-outcomes`、Learning Record 和 Assessment canonical contracts；不创建第二套事实、mastery 或路径模型。
- 后续：`retire-legacy-adaptive-entrypoints` 在全部 recommendation/intervention 调用迁移并完成架构证明后清理旧入口。

## Impact

- 影响 `src/lib/data-governance/recommendation-engine.ts`、student recommendation/profile API、`src/features/ai/companion/intervention-engine.ts`、AI intervention routes、assessment remediation/micro-tutoring、worker/scheduler consumers 及对应测试。
- 需要策略、隐私、事件幂等、EvidenceOutbox 数据库唯一性、worker crash/replay、重复投递、direct+outbox 双计负例和无 mastery 晋级的 characterization 与域验证；不得把原始答案、用户标识或模型原文放进公开 recommendation/outbox receipt。
- 不迁移生产历史事实、不部署、不激活生产 selector；旧表仅在仍有其他领域消费者时保留。
