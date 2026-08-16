## Why

当前 Portrait v2 物化器按 `userId` 读取全部 LearningFact，历史客户端贡献、回填、fixture 和重算事实可能已被纳入已有快照。仅阻断后续写入入口无法修复已污染 Portrait，旧画像仍会继续作为路径规划和推荐输入。

## What Changes

- 新增版本化 `Trusted Learning Fact Filter`，基于现有服务端证据锚点判定可信事实，不新增 `trusted` 字段、不修改 LearningFact 表结构。
- Portrait v2 物化核心在读取 LearningFact 后统一过滤不可信事实；全量重建、增量更新和 legacy compatible snapshot 共用同一过滤。
- 升级 Portrait v2 计算版本和迁移版本，触发全量重建；通过现有 current pointer 原子切换，保留旧快照供审计。
- 无可信事实或仅存在非可信历史事实时发布明确的 `NO_EVIDENCE` 状态。
- learner-state service、推荐上下文和路径规划对 `NO_EVIDENCE` fail closed，禁止回退 legacy snapshot、feature cache、旧 StudentCompetencySnapshot 或旧 competency vector。
- 保留默认或非个性化路径能力，但禁止基于非可信能力画像生成个性化推荐。

## Capabilities

### New Capabilities
- `trusted-learning-fact-filter`: 定义版本化的可信 LearningFact 判定策略，以及 Portrait v2 物化使用该策略的一致性要求。

### Modified Capabilities
- `adaptive-learner-state-service`: 修改 cumulative portrait 与 NO_EVIDENCE 的语义，要求只消费可信事实，并禁止 fallback 到非可信 legacy 状态。
- `adaptive-learning-path-planning`: 修改路径规划对 learner state 的消费边界，要求无可信 Portrait 时不得回退到非可信能力画像。

## Impact

- 数据治理核心：`portrait-v2-materialization.ts`、`portrait-v2-incremental-update.ts`、`cumulative-learner-state.ts`。
- 消费边界：`adaptive-learner-state-service.ts`、`recommendation-engine.ts`、`adaptive-learning-path-planner.ts`。
- 版本常量：`portrait-v2-model.ts`。
- 数据约束：不修改 LearningFact schema，不删除历史数据，不改变 HTTP API。
- 测试：新增可信过滤、NO_EVIDENCE、增量一致性、消费边界和重复重建确定性测试。
