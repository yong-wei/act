## Why

Issue #1983 反馈：学生生成「控制系统校正设计」学习路径时返回 4 条候选（推荐路线、基础补救、仿真与 Arena 冲刺、偏好匹配路线），超出产品约定的 3 条。现有 spec `adaptive-learning-path-planning` 的 requirement「Control-correction planner returns three path styles」已约定三条可比路线，当前实现违反该合同。

根因（已调查确认）：

- `resolvePolicyBundleRequest`（`src/features/personalization/path-planning/internal/assemble-plan.ts:4819`）在冷启动、低置信或证据 ≤1 时自动注入 starter 策略族 `['foundation-remediation', 'simulation-driven', 'preference-matched']`（来自 `src/features/personalization/plugins/control-correction/path-planning-policy.ts:58`）。
- `buildPolicyBundle`（同文件 `:5020`）以 `unique([primaryPolicyFamily, ...requestedFamilies])` 无条件把主规划族 `rules-plus-graph-search`（「推荐路线」）并入候选集合，形成 4 条。
- `buildSerializablePathOptions`（`:2666`）将 `policyBundle.paths` 全量序列化为候选卡片，候选批次持久化（`adaptive-path-candidate-batches.ts`）与页面比较、选择、调整均消费该 4 条集合。
- 学生画像不可用（Issue #1984 的 `migration-in-progress`）恰好命中 starter 注入条件，使该路径在默认验证流程中稳定复现。

## What Changes

- 当策略族请求显式存在（starter 注入或显式请求）时，候选集合恰好由请求族构成；主规划族不再作为额外候选追加。主路径仍作为生成结果的主线（默认执行基线），但不进入候选卡片集合。
- `starterPathPolicy` 增加目标候选数语义（`targetOptionCount: 3`，与 `policyFamilies` 数量一致），序列化候选与候选批次持久化的 `candidateCount` 在正常多样性可用时恒等于 3。
- 资源多样性不足时维持既有 fallback 语义（显式低资源/低置信状态），不得以第 4 条路线补数，也不得伪造 3 张实质相同的卡片。
- 增加回归测试：默认策略注入、低画像置信度、冷启动（无 learner state）三类场景断言 `optionCount === 3`；候选批次 `candidateCount === 3`；页面候选卡片数量为 3。

## Capabilities

### Modified Capabilities

- `adaptive-learning-path-planning`: starter/默认策略注入路径产出的候选集合恒为目标候选数（3），主规划族不再追加为第 4 条候选。
- `adaptive-path-candidate-batches`: 成功生成的不可变候选批次记录目标候选数合同，验收断言 `candidateCount === 3`。

## Impact

- `src/features/personalization/path-planning/internal/assemble-plan.ts`（`resolvePolicyBundleRequest`、`buildPolicyBundle`、`buildSerializablePathOptions`）。
- `src/features/personalization/plugins/control-correction/path-planning-policy.ts`（starterPathPolicy 增加目标候选数声明）。
- 候选批次持久化与 `path-advisor-tool` 响应中的 optionCount 契约测试；自适应路径中心卡片数量合同测试。
- 不改变策略族本身的规划语义、推荐依据结构、候选身份/幂等合同，也不改变主路径执行基线行为。
- 与 Issue #1984（画像不可用治理）、#1985（资源偏好优先级）独立；#1984 修复后 starter 注入触发频率会下降，但本变更保证任何触发路径下候选数恒为 3。
