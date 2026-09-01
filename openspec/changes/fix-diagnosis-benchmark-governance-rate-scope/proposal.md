## Why

#1744 修复后的 live 评测（21/24 成功、成功报告全部治理合规、准确性全部达标）仍被阈值门禁误判失败：聚合治理合规率（中文、证据引用、归因、覆盖主张）以全部 replicate 为分母，把被治理门拒绝与生成失败的 replicate 记为不合规。被拒绝的 replicate 恰是治理生效的证明（#1729 spec 已明确 calibration-rejected 不计入误报），当前分母与 generationSuccessRate 重复计数且语义反转。

## What Changes

- `computeScenarioMetrics` 的四个治理率（chineseComplianceRate、evidenceReferenceValidityRate、attributionValidityRate、coverageClaimAccuracyRate）分母改为 `status === 'ok'` 的 replicate；无成功 replicate 的场景治理率记 1（无输出即无违规输出）。
- `generationSuccessRate` 保持全 replicate 分母不变；违规细节继续保留在 replicate 记录（failureReason）中可审计。
- spec `diagnosis-accuracy-regression-gates` 的指标 requirement 澄清治理率分母语义。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `diagnosis-accuracy-regression-gates`: 治理合规率分母语义澄清（成功 replicate 口径）。

## Impact

- 受影响代码：`src/lib/diagnosis-benchmark/metrics.ts`、相关单测。
- 行为影响：仅评测指标口径；生产诊断链路不变。
- 验证：单测覆盖新分母语义；重放第二次 live run 的 evaluations 后聚合 passed = true。
