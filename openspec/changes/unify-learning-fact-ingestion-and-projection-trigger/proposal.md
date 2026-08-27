## Why

当前 interactive event route 先调用 `routeEvent`，又直接调用 `persistCoreLearningFact`；core 事件和 Redis worker 因而可能双重物化。Redis `RPOP` 在处理前移除消息，进程崩溃会丢失输入；直接 fact path 也不总能触发 snapshot。Assessment/Personalization outbox 与内部调用混用，导致“事实已写入但 projection 未调度”和“同一事实多次计数”都难以证明。

## What Changes

- 建立唯一的 canonical `LearningFact` ingestion application API，统一校验、映射、去重、回放和 projection trigger。
- 同事务事实使用直接入口；只有真实跨进程边界使用 staging outbox，禁止 direct + outbox 双写。
- 将 worker transport 改为可恢复的 claim/lease 或等价 ack-after-success 协议，禁止破坏性 `RPOP` 作为处理语义。
- 统一 `LearningEventBatch`、EvidenceOutbox、backfill 和 direct core path 的状态、失败、重试和幂等口径。
- 每次成功事实写入都由同一 coordinator 产生一次受影响 learner/class projection trigger，解决 direct path 漏调度。

## Scope

范围包括 ingestion application boundary、staging/worker protocol、dedupe/replay/failure state、projection trigger 和相应 tests/ledger。它不实现 current projection 的字段设计、不迁移生产数据、不部署、不切换 selector；Assessment 的同事务 direct fact、Personalization 的真实跨进程 outbox、Arena official authority 仍按其既有 owner 工作。

## Dependencies and Coordination

- 依赖 `define-learning-record-event-contract` 的版本化 envelope、authority、scope 和 privacy 规则。
- 依赖 `migrate-personalization-recommendations-and-interventions` 的 EvidenceOutbox 状态机与“worker sole materializer”边界。
- 保持 `restore-incremental-learning-state-truth` 的 processing/state watermark 区分和现有 learner/class scheduling 约束；不复制其 selector 或 Redis redesign。

## Success Criteria

- 每个 LearningFact 只经过一个 canonical ingestion API；同一事件/事实在并发、重试和回放下不重复计数。
- direct same-transaction 与 cross-process staging 的选择可由 producer characterization 证明；不存在同一 producer 的 direct + outbox 双写。
- worker 在 crash、lease 过期和重启后可恢复；只有事实事务和 projection trigger 成功持久化后才 ack。
- core、secondary、Assessment、Personalization、backfill 均能触发同一 projection coordinator；无事实静默缺少 trigger。
- raw event 仍是输入/审计材料，不被新 API 直接当作第二条事实真源。
