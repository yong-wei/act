## Why

当前 `/api/interactive/events`、data-governance worker、Arena/Assessment 写回和历史脚本都可能触及 LearningFact。已有 canonical ingestion 与 event contract，但调用方式、同步/异步分类和重复 materialization 仍需按当前 HEAD 重新核对；否则后续迁移无法判断哪个入口是真正权威。

## What Changes

- 建立绑定当前修订的 Learning Record producer denominator，覆盖路由、worker、outbox、backfill、报告和测试入口。
- 将每个写入点标记为同事务 typed call、跨进程 staging、显式 correction/replay 或受控 backfill，并记录 owner 与删除条件。
- 以既有 canonical ingestion/write boundary 和 event registry 为核对基准；不强迫内部调用伪造事件，也不在本变更提前迁移 C6/C7 的业务 adapter。
- 用 characterization tests 证明 direct/outbox 同义输入的 dedupe、trigger、anchor、time、privacy 和 failure 行为一致。
- 删除或隔离经零调用者和 parity 证明的重复 writer；无法证明的入口保留为明确例外，不静默改写。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `learning-fact-ingestion-and-projection-trigger`: 增加唯一写 owner、transport 分类、producer denominator 和 backfill 隔离要求。
- `learning-record-event-contract`: 明确写边界核对不得复制协议，且内部同事务操作继续使用应用 API。

## Impact

- 事件与写入实现：`src/features/learning-record/ingestion/**`、`src/features/learning-record/event-contract/**`、`src/lib/data-governance/event-protocol.ts`、`event-normalization.ts`、`learning-fact-materialization.ts`、`event-buffer.ts`。
- 生产与异步入口：`src/app/api/interactive/events/route.ts`、`scripts/workers/data-governance-worker.ts`、Arena/Assessment/Personalization evidence writeback。
- 历史工具与验证：`scripts/db/backfill-learning-facts-from-*`、`materialize-historical-learning-facts.ts`、`src/lib/canonical-learning-fact-identity/inventory.ts` 及相关 data-governance tests。
- 仅影响实现路径和治理记录；不改 LearningFact 公开身份、评分、画像、排行榜或生产 selector。
