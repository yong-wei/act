## Context

C5 已核对当前 writer 边界，C6/C7 将 Assessment、Personalization、Arena 和 Teacher 业务 adapter 迁出通用治理层。此时 `src/features/learning-record/ingestion/**` 仍包含多个 payload 读取、envelope 处理、dedupe 检查、schema/allowlist guard 和 direct/outbox 分支；它们的职责重叠，但都承载隐私、时间、revision、outbox 和恢复语义。

本变更是行为保持的代码简化。迁移责任、事件协议和事实语义在本变更中冻结；若某项修改改变业务输出或权限，应退回对应 owner change，而不是并入简化。

## Goals / Non-Goals

**Goals:**

- 用一个清晰的 canonical normalized-input pipeline 表达现有 ingestion 行为。
- 删除重复 envelope/parser、dedupe-key 计算、内部 guard 和无价值 forwarding wrapper，同时保留每个仍有独立语义的边界。
- 通过 before/after characterization 证明所有输入、输出、错误、顺序、副作用和恢复行为不变。
- 降低模块复杂度、重复路径和无调用者代码，保持可审计、可回滚。

**Non-Goals:**

- 不新增 event contract、payload schema、数据库表、公共业务 API 或第二个 ingestion authority。
- 不改变 Assessment/Arena/Teacher/Personalization owner、LearningFact identity、官方结果或 projection 算法。
- 不移除错误处理、隐私 sanitizer、retention、replay authorization、outbox/transaction 或 backfill 隔离。

## Decisions

### 1. 先锁定 before，再逐项简化

按 code-simplification skill 执行：阅读调用者、callee、边界测试和 git blame，记录每个 wrapper/parser/guard 的责任；随后一次只改一个等价点，运行直接回归，比较结果后才进入下一项。没有明确行为等价证明的候选不改。

before/after 至少比较：canonical output/digest、status/error code、source anchors、trusted/server times、dedupe/trigger 次数、事务提交、outbox status、ack 时机、privacy forbidden-field 结果和重试/崩溃恢复。

### 2. 统一实现而不是压平语义

可共享的 normalized input、anchor/time、allowlist、dedupe 和 trigger 计算进入唯一 pipeline；direct 与 staged/outbox 只保留 transport-specific orchestration。若 helper 表达安全边界、审计意图或可测试的领域概念，即使代码较短也保留。

不采用“把全部逻辑内联到一个大函数”的方式；目标是更快理解和更少重复，而非最少行数。

### 3. 删除旧路径需有完整证据

每次删除都要有零生产/测试 required caller、替代路径 parity、静态/动态 canary、行为测试和回滚说明。只删除本次简化造成的 orphan import/test；历史工具和 owner adapter 的删除留给 C9 或相应 change。

### 4. 可靠性和隐私是不可变约束

worker 仍在 fact 事务与 trigger intent 成功提交后 ack；失败保持 retryable/terminal receipt。allowlist 仍拒绝 raw answer、prompt、model/parser text、直接标识与 exception echo；source anchors、trustedOccurredAt/receivedAt/materializedAt、revision、decoder/materializer 版本和 backfill mode 不被简化丢失。

## Risks / Trade-offs

- [Risk] 看似重复的 parser 实际承担旧版本兼容。→ 先查 contract/decoder/version 和 blame；无兼容证据不删除，必要时保留显式 adapter。
- [Risk] 合并 direct/outbox 分支改变事务或 ack 顺序。→ 保留 transport-specific commit/lease boundary，加入 crash-before-ack 与 concurrent replay 测试。
- [Risk] 删除 guard 造成 raw 字段或跨 revision 进入事实。→ before/after 递归 forbidden-field、cross-revision、clock-skew 和 payload allowlist 负例必须完全一致。
- [Risk] 为压缩代码误删 audit/rollback 信息。→ 把 failure receipt、retention、replay 和 deletion verification 纳入 characterization 维度。

## Migration Plan

1. 固定 C6/C7 完成后的 clean revision 和 ingestion before snapshot，建立 call graph/复杂度/行为基线。
2. 按单项简化顺序合并 normalized parsing、identity/dedupe、guard 和 trigger 逻辑；每项独立运行回归。
3. 删除已无调用者的 wrapper/parser/guard，更新只因删除产生的导入和测试孤儿；不改业务测试期望。
4. 在最终 revision 运行 ingestion、event contract、outbox/worker、privacy、PostgreSQL、typecheck 与 strict OpenSpec。

回滚使用上一个已通过 characterization 的 revision；不得恢复第二套 writer、宽泛 payload 或破坏性队列读取。

## Open Questions

- C6/C7 的最终 owner migration receipt 是否已绑定同一 ingestion 入口，由实现开始前的依赖门禁确认。
- 可删除 helper 的最终名单必须以 clean revision 的调用图和 before/after 结果为准，本设计不预设文件名。
