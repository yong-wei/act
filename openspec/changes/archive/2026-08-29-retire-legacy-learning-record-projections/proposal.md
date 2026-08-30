## Why

现有 Redis destructive queue、重复 materializer、raw page aggregators 和 legacy projection/services 与 canonical LearningFact/current projection 并存。若只停掉一个 worker 或删除一个 service，producer、consumer、backfill、report 仍可能把历史路径重新启用，造成漏数、双计数或 privacy bypass。退休必须由完整分母、迁移/回放、水位和 revision 证据驱动，并保留历史事实与 snapshot。

## What Changes

- 建立 producer/consumer/worker/backfill/report 的 retirement ledger、零 caller 证明和 revision-bound migration receipt。
- 在所有输入与消费者迁移、积压 drain/replay、watermark/digest parity 和 crash/recovery 证据闭合后，删除旧 Redis destructive queue/RPOP 路径。
- 删除重复 LearningFact materializer、raw page aggregators 和 legacy projection/services；将必要的 audit/debug/migration 读取保留为明确受限操作。
- 保留历史 `LearningFact`、snapshot、transition、outbox receipt 和可回滚的 current pointer；不做历史数据删除或生产 selector/deploy。
- 用并发、crash、回放、隐私和删除后 zero-caller 测试证明退休不会造成事实丢失、双计数或越权读取。

## Scope

范围包括退休门禁、证据台账、迁移/回放核对、旧 queue/materializer/aggregator/service 的代码删除条件和测试。它不执行生产数据迁移、部署、selector/cutover 或物理删除历史 facts/snapshots。

## Dependencies and Coordination

- 依赖 `migrate-learning-record-consumers` 和 `externalize-control-correction-learning-record-adapter` 的完成与 zero-caller 证据。
- 复用 `define-learning-record-event-contract`、canonical ingestion、current projection、trusted filter、evidence governance 和 active `ground-evidence-copilot` contracts。
- retirement 不改变 Copilot server-authorized context、Arena official authority、Assessment direct fact 或 Personalization plugin ownership。

## Success Criteria

- 生产者、消费者、worker、backfill、report 分母逐项记录 migrated/current/retired 状态、owner、revision、receipt 和 rollback 条件。
- 旧 Redis destructive queue 只有在 producer 切换、积压 drain/replay、ack/failure receipt 和 watermark parity 全部闭合后才可删除。
- 删除后 codegraph/rg caller 清单不再显示运行时依赖；审计/迁移用途使用受限 read ports 或明确 operation。
- 历史事实和 snapshot 完整保留，current failure 可保留上一条 qualified projection，任何删除都不改变 official score 或隐私边界。
