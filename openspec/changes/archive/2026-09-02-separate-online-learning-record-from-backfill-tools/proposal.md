## Why

历史 evidence backfill、materialization 和 report regeneration 与 online Learning Record runtime 共享入口。没有显式 operation、冻结 cutoff、最小权限和 durable receipt 时，离线修复可能被普通页面调用，或误推进 current pointer、live watermark 和在线 outbox。

## What Changes

- 建立 online projection/runtime 与 historical backfill command/worker 的明确入口和权限边界。
- 为 backfill 增加 dry-run/apply、稳定 operation identity、scope、frozen cutoff/input digest、per-input outcome、terminal/deletion receipt 和 replay 审计。
- 让普通 backfill 不能读取或发布 online current pointer、伪造实时 watermark、覆盖来源 anchor 或进入在线 fallback。
- 在调用者分母、parity、权限和回滚证据闭合后删除旧生产 backfill/materialization 入口；历史只读工具和专用 cutover migration 单独保留。
- 保持 Learning Record event/ingestion contract、事实 identity、projection 算法和现有业务语义不变；本变更不调用 code-simplification。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `course-evidence-backfill-reporting`: 增加离线 operation、权限、冻结输入和 receipt 约束。
- `learning-record-consumers`: 正常 consumer 不得调用 backfill 或以其作为 raw/current fallback。
- `learning-record-current-projections`: 普通 backfill 不得移动 online current pointer；专用 cutover 必须沿用既有 fence 合同。
- `legacy-learning-record-projections`: 删除生产入口前须闭合 online/backfill caller denominator 和替代证据。

## Dependency

本变更是原 C9 的前置边界迁移。后续纯 projection 简化 `simplify-learning-record-projections` 必须 blocked by 本变更完成。

## Impact

- Commands/workers：`scripts/db/backfill-*`、`backfill-learning-facts-from-*`、`materialize-historical-learning-facts.ts`、`src/lib/data-governance/course-evidence-backfill.ts` 及其 worker/receipt tests。
- Online boundary：`src/features/learning-record/projections/**`、`consumers/**`、`src/app/api/user/profile/route.ts`、teacher/AI/Personalization evidence routes。
- Legacy production entries：由当前 HEAD caller inventory 确认的 raw aggregator、backfill route、scheduler/job registration 和 fallback adapter。
- 不包含数据库 schema 重建、历史事实删除、生产 backfill 执行、selector/cutover 或 projection 算法改写。
