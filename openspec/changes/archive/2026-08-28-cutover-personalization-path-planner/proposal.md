## Why

路径规划的真实实现分散在约 5979 行的 `src/lib/adaptive-learning-path-planner.ts` 与 `src/lib/act-prerequisite-path-planner/`。候选发现、资格判断、排序、约束修复、组装和解释既没有清晰的应用边界，也被 advisor、candidate batch、learning-path API、Konling 和课程调用者以不同入口复用。这样会把硬资格与软推荐混在一起，并让旧 `src/lib` 实现继续充当第二个 Personalization authority。

## What Changes

- 建立唯一的 Personalization `PlanLearningPath` application use case，按 `GoalContextLoader → CandidateProvider → EligibilityPolicy → RankingStrategy → ConstraintRepair → PathAssembler → ExplanationBuilder` 拆分可测试的 pipeline。
- 让候选来源、课程插件、Learning Record/Assessment read ports 和路径历史通过边界注入；硬资格、软排序、约束修复和解释互不越权，不引入 RL 或第二套路径 schema。
- 迁移 learning-path、path advisor、candidate batch、Konling、path adoption/execute/correction 等所有调用者，使它们只依赖公开 API，并保持现有认证、证据、终点校验、版本和 append-only 历史语义。
- 在调用者归零并完成架构证明后删除 `src/lib/adaptive-learning-path-planner.ts` 与 `src/lib/act-prerequisite-path-planner/` 的权威实现；不保留 re-export、facade 或隐式 fallback。

## Capabilities

### New Capabilities

- `personalization-path-planning-pipeline`: 定义唯一的 PlanLearningPath 用例和七阶段候选到路径的职责边界。

### Modified Capabilities

- `adaptive-learning-path-planning`: 收紧为单一、可解释、受约束的 Personalization pipeline，并保留路径历史和证据不变量。

## Dependencies

- 前置：`reduce-personalization-learner-state`、`externalize-control-correction-personalization-plugin`，以及已 qualified 的 `establish-modular-monolith-refactor-charter`、`enforce-modular-domain-dependency-contracts`。
- 复用 canonical candidate batch、control-correction、ResourceNode、knowledge state、path evidence 和治理合同；不创建平行候选、路径或课程策略模型。
- 下游：`migrate-personalization-recommendations-and-interventions` 可调用唯一规划用例；`retire-legacy-adaptive-entrypoints` 只在本 change 清除全部旧 planner 入口后执行。

## Impact

- 影响 `src/lib/adaptive-learning-path-planner.ts`、`src/lib/act-prerequisite-path-planner/`、`src/app/api/learning-paths/`、`src/app/api/adaptive/path-advisor-*`、candidate batch API、Konling 及路径执行/修正调用者。
- 需要 characterization、阶段级单元测试、API 兼容和架构导入图验证；路径历史、候选证据、终点能力和生产 selector 不迁移、不重写。
- 不部署、不激活生产切换；回滚仅保留代码版本和不可变历史，不以旧 planner facade 作为运行时回退。
