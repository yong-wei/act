## Why

C6/C7 完成业务适配迁移后，Learning Record ingestion 仍可能保留多套 envelope/parser、dedupe-key 解析和内部 schema guard。它们增加理解成本，却不能成为第二套事实或事件协议；需要在已有行为被锁定后做一次可回滚、可验证的局部简化。

## What Changes

- 对 canonical ingestion 建立 before characterization 和调用者/副作用清单。
- 将 direct、staged/outbox 的输入归一化、anchor/time、allowlist、dedupe、fact persistence 和 projection trigger 组织为一个清晰 pipeline。
- 删除只做重复转发、重复解析或无独立语义 guard 的旧路径，并移除由本次删除造成的 orphan imports/tests。
- 每个简化按 code-simplification skill 逐项执行，保存 before/after 行为与复杂度证据。
- 保持 event contract、append-only facts、outbox/transaction、watermark、privacy、retry/crash 和 backfill 边界不变。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `learning-fact-ingestion-and-projection-trigger`: 增加 canonical pipeline 的行为保持和单一实现要求。
- `learning-record-event-contract`: 规定实现简化不得改变已注册事件、身份、时间、allowlist 或兼容行为。

## Impact

- `src/features/learning-record/ingestion/**`、`event-contract/**` 及其单元/contract tests。
- 同步/异步边界：`scripts/workers/data-governance-worker.ts`、`src/lib/data-governance/event-buffer.ts`、`learning-fact-materialization.ts`、相关 outbox 调用。
- 可能删除的对象由 before/after 调用图确定；不得预先批量删除 `data-governance` 业务 owner 或历史工具。
- 无数据库 schema、事件格式、业务算法、生产 selector 或历史事实迁移。
