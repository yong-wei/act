# Design: fix-adaptive-path-option-count

## 根因模型

候选数量在两处叠加：

1. `resolvePolicyBundleRequest` 判定 starter 场景（`!learnerState || confidence.level === 'low' || evidenceCount <= 1`）时注入注册 goal 的 `starterPathPolicy.policyFamilies`（3 族）。
2. `buildPolicyBundle` 以 `unique([primaryPolicyFamily, ...requestedFamilies])` 构造遍历族列表。`primaryPolicyFamily` 是主规划调用的族（stage-1 rules-graph，`rules-plus-graph-search`），不属于 starter 族，因此最终 4 族各产出一条候选路径。

`buildSerializablePathOptions` 直接把 `policyBundle.paths` 全量映射为候选卡片；`persistAdaptivePathCandidateBatch` 用同一集合写 `candidateCount`。比较、选择、调整（`path-advisor-tool`、`learning-paths/[id]/choices`）都消费该集合，因此 4 条贯穿全链。

## 决策

- **收敛点选在 `buildPolicyBundle` 的族解析，而不是序列化截断。** 截断会掩盖「哪条该被去掉」的语义问题；在族解析处让 `requestedFamilies` 非空时以请求族为准、primary 不追加，保证每条候选都有被请求的策略意图。主路径（primary plan）保持为生成结果的主线基线，行为不变。
- **目标候选数声明落在 `starterPathPolicy.targetOptionCount`。** 与 `policyFamilies` 同源声明，避免两处数字漂移；规划器校验请求族数量与 target 一致（不一致时以显式配置错误 fail fast，而不是静默多出或截断）。
- **多样性不足维持既有 fallback。** 现有 `omittedPolicyReasons`（`policy-path-resource-missing` / `policy-option-diversity-unavailable`）与低资源 fallback 语义不变；不得用 primary 族回填缺口。
- **`minOptions: 2` 语义退役为 targetOptionCount。** 现有 starterPathPolicy 只有 minOptions 下限，没有上限/等值语义；本变更以 targetOptionCount 取代，注册 goal 定义同步更新。

## 影响面与不变量

- 候选身份（`ordinal`、fingerprint、batch idempotency）与选择回写合同不变；变化的只是集合成员数从 4 收敛为 3。
- 非 control-correction goal 无 starterPathPolicy 时维持单 option 序列化行为（`buildSerializablePathOptions` 的 fallback 分支）。
- 页面侧卡片渲染、比较视图天然跟随服务端集合；UI 合同测试补 3 卡断言即可，不改交互结构。

## 测试策略

- 规划器单测：starter 注入（无 learnerState、低置信、证据 ≤1）三类输入断言 `policyBundle.paths.length === 3` 且不含 `rules-plus-graph-search`。
- 序列化与批次：`buildSerializablePathOptions` 输出 optionId `path-option-1..3`；`persistAdaptivePathCandidateBatch` 写入 `candidateCount === 3`。
- 既有 4 条断言的测试同步更新（搜索 `__tests__` 中 policyBundle/option 数量断言）。
- 合同测试：`path-advisor-tool` generate 响应 `optionCount === 3`。
