## Why

通用 learner-state/personalization 代码直接包含 control-correction 的课程、lesson 和 Arena task 标识，并把该课程的证据与持久化策略混入通用 service。这样新增或修改一门课程必须修改全局 Personalization，且容易把课程事实误当成通用 learner state 事实。

## What Changes

- 建立以 `goalId` 为键的 Personalization plugin registry；control-correction plugin 独占课程/lesson/Arena 映射、目标维度、证据来源和策略配置。
- 将当前 `CONTROL_CORRECTION_*` 常量、课程特定 evidence/persistence 分支和 goal-slice 组装迁入插件 contract；通用 Personalization 只依赖稳定插件接口。
- 让插件通过 Learning Record/Assessment read/write ports 消费和声明治理事实，保留 evidence provenance、置信度、隐私、幂等和不可变 revision；插件不得直接绕过域边界写 Prisma。
- 迁移 learner-state、path、recommendation、Konling、Arena/lesson consumers，并对未知 goal、缺失插件、版本漂移返回显式 unsupported/limited 状态。
- 删除通用层的课程硬编码和重复 goal registry/compatibility entry，更新依赖与退役台账；不改 control-correction 的既有学生/教师产品语义。

## Capabilities

### New Capabilities

- `control-correction-personalization-plugin`: 定义课程特定 Personalization plugin 的注册、上下文解析、证据/隐私/持久化策略和版本边界。

### Modified Capabilities

- `adaptive-learner-state-service`: control-correction goal slice 通过注册插件提供，通用 service 不再拥有课程 ID。
- `evidence-driven-personalization`: 推荐与画像只消费 plugin 声明的受治理证据，不从课程 ID 或原始 payload 推断能力。

## Dependencies

- 前置：`reduce-personalization-learner-state`、以及已 qualified 的 charter/dependency contracts。
- 复用：`adaptive-learning-governance-contracts`、`adaptive-mastery-state`、`control-correction-diagnosis-profile`、`adaptive-learning-path-planning` 的现有隐私、置信度、证据和路径规则。
- 下游：`cutover-personalization-path-planner` 与 `migrate-personalization-recommendations-and-interventions` 通过 plugin public contract 消费课程策略；`retire-legacy-adaptive-entrypoints` 删除旧硬编码入口。

## Impact

- 影响 `src/lib/data-governance/adaptive-learner-state-service.ts`、`src/lib/adaptive-learning-path-planner.ts`、goal/slice registry、control-correction evidence/persistence adapters 及 learner-state/path/Konling/Arena/lesson 调用者。
- 影响 plugin registry、版本化配置和针对测试；不修改 Assessment answer、LearningFact 或 Arena 官方评测的权威 schema。
- 不部署、不切换生产目标、不把 plugin registration 当作 production activation。
