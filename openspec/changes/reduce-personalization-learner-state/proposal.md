## Why

`src/lib/data-governance/adaptive-learner-state-service.ts` 同时读取 Prisma、LearningFact、Assessment、Personalization、路径、Arena 和课程特定数据，既是状态读取器又是状态计算器。它把事实、掌握度、推荐输入和 control-correction 逻辑混在一个公开 service 中，使 reducer 无法脱离数据库测试，也让每个调用者继续依赖一个不断膨胀的全局入口。

## What Changes

- 建立纯 `LearnerStateReducer`：输入只来自 Learning Record read ports 和 Assessment read ports 的已归一化事实/结果，输出确定性的 learner-state projection。
- 将数据库、snapshot、evidence-cache、Arena 和路径读取移到 adapter/application 层；保留一个角色有界的 Personalization learner-state public API。
- 迁移 adaptive learner-state route、profile、Konling、graph center、recommendation、student evidence cache 和其他真实调用者，保持 portrait v2、mastery 置信度、隐私、来源和 no-data 语义。
- 删除旧 `adaptive-learner-state-service` 的公开权威入口和转发，不建立第二个 learner-state 计算器；旧数据表和仍服务其他领域的读模型继续保留。
- 让 pure reducer、read-port contract、调用者迁移和删除证据进入同一台账；不改变课程插件与 path planner 的后续 owner 分工。

## Capabilities

### New Capabilities

- `personalization-learner-state-reducer`: 定义纯 reducer、Learning Record/Assessment read ports、角色投影和唯一 learner-state public boundary。

### Modified Capabilities

- `adaptive-learner-state-service`: 收紧为 read-port 驱动的 server-owned projection，禁止数据库/路由混入 reducer，并要求旧公开入口在迁移后删除。

## Dependencies

- 前置：`cutover-path-owned-assessment-attempts`；其 Assessment public API 是评估结果和掌握度输入的唯一来源。
- 前置：`establish-modular-monolith-refactor-charter`、`enforce-modular-domain-dependency-contracts` 的 owner、ports/adapters 和依赖规则。
- 下游：`externalize-control-correction-personalization-plugin` 消费 reducer 的 goal/plugin context；`cutover-personalization-path-planner` 和 `migrate-personalization-recommendations-and-interventions` 只读该公开边界；`retire-legacy-adaptive-entrypoints` 最终清场旧入口。

## Impact

- 影响 `src/lib/data-governance/adaptive-learner-state-service.ts`、`cumulative-learner-state.ts`、portrait/evidence adapters、`src/app/api/adaptive/learner-state/route.ts`、`src/app/ai/page.tsx`、Konling/graph/recommendation/feature-cache 调用者及其测试。
- 影响模块依赖和测试边界；不修改 LearningFact、Assessment answer、portrait v2 或仍被其他领域使用的 Prisma 表结构。
- 不部署、不执行历史画像回填、不切换生产 feature flag；迁移完成的 flag/shim 由退役 change 统一处理。
