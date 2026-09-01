## Why

Assessment 的提交/评分写回和 Personalization 的状态、路径、推荐适配仍有部分实现位于 `src/lib/data-governance`。这使事实 ingestion、题目证据语义和课程插件策略互相越界，也让同一证据出现多个 owner；C5 已建立写边界后，需要把业务适配迁回领域而不是继续在 Learning Record 中扩展分支。

## What Changes

- 将 Assessment attempt/scoring/evidence adapter 收敛到现有 Assessment public API 和 durable attempt owner。
- 将 Personalization learner-state/path/recommendation/intervention adapter 收敛到现有 reducer、path-planning、plugin 和 policy owner。
- 让两类 owner 通过既有 Learning Record read/write ports 交换最小、版本化、可追溯的证据。
- 迁移所有 route、worker、脚本和测试调用者，按 owner 重新计算 producer/consumer denominator。
- 删除已证明无调用者的 `data-governance` business adapter；保留历史/审计 adapter 时明确其只读和授权边界。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `assessment-domain-attempts`: Assessment 负责 assessment-to-evidence adapter 和 durable write contract。
- `adaptive-assessment-persistence`: 评分与 provisional evidence 经 Assessment owner 调用 canonical Learning Record writer。
- `personalization-learner-state-reducer`: Personalization 负责证据 read-port 组合和 plugin-aware projection。
- `evidence-driven-personalization`: 推荐/干预适配只使用领域拥有的规范化证据，不在 data-governance 保留业务策略。

## Impact

- Assessment：`src/features/assessment/public-api.ts`、`application/attempts.ts`、`adaptive-persistence.ts`、`adaptive-assessment/**`、`micro-intervention-*`、`wrong-answer-attribution.ts` 及其 tests。
- Personalization：`src/features/personalization/learner-state/**`、`path-planning/**`、`recommendations/**`、`interventions/**` 与 plugin adapters。
- 迁移来源：`src/lib/data-governance/adaptive-learner-state-service.ts`、`recommendation-engine.ts`、`kaq-evidence-writeback.ts`、`student-evidence-feature-cache.ts` 和由 C5 清单确认的 assessment/path adapter 文件。
- API/worker/script 调用者保持现有外部响应兼容；Learning Record event contract、官方评测、画像资格和生产选择器不变。
