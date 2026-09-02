## Why

A 已将 online Learning Record runtime 与历史 backfill 工具分离并固定操作合同。在线 projection/read-model 仍存在重复聚合、legacy fallback 和不必要的 orchestration；这些实现复杂度应在边界稳定后单独进行行为保持简化。

## What Changes

- 仅简化 online current projection、read-model 和 consumer orchestration，删除已证明重复的聚合、fallback、wrapper 或 cache authority。
- 在实现前主动使用 `code-simplification`，记录每个候选的责任、调用者、历史原因和测试，并建立冻结的 before/after characterization。
- 逐项验证相同输入下的 projection digest、status、watermark、scope、privacy、small-sample、known-zero/missing/stale 语义，再删除旧路径。
- 保持 A 已建立的 backfill command/worker、权限、operation identity、receipt 和 current-pointer 合同；本变更不修改历史操作入口或生产数据。
- 保持 append-only facts、immutable snapshots、qualified current fence、Arena official authority 和普通页面不读取 raw 事实重建画像。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `learning-record-current-projections`: 纯化 online current projection/read-model 实现，保持 qualification、fence、watermark 和 status。
- `learning-record-consumers`: 删除重复页面聚合与 fallback，保持 role-safe ports、隐私和 truthful status。
- `legacy-learning-record-projections`: 仅删除有 parity/zero-caller 证据的 legacy projection path。

## Dependency

本变更必须 blocked by `separate-online-learning-record-from-backfill-tools`；A 的 online/backfill 边界、命令权限和 receipt 合同稳定后才可实现。

## Impact

- Online implementation：`src/features/learning-record/projections/**`、`consumers/**`、`src/lib/data-governance/portrait-v2-*`、`cumulative-*`、`student-evidence-feature-cache.ts`、`profile-center.ts`。
- Consumer routes/tests：student profile、Teacher insights/evidence、AI context、Personalization learner-state 和 projection/data-governance tests。
- 只触及行为保持的 projection/read-model 实现与其重复旧路径；不触及 A 的 backfill commands/workers/permissions/receipts。
