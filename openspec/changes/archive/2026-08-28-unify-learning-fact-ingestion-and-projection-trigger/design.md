## Context

`src/app/api/interactive/events/route.ts` 对同一请求同时走 event buffer 和 core fact writer；`src/lib/data-governance/event-buffer.ts` 的 Redis 读取在业务处理前使用 `RPOP`。worker 以 batch 映射事实并在部分路径调度 snapshot，但直接 core fact 写入没有统一保证。已有 `EvidenceOutbox`、`LearningMaterializationOutbox` 和 cumulative jobs 可以复用，但不能再引入第二套物化状态机。

## Goals

- 让事实写入、去重、失败恢复和 projection trigger 由一个 application API 负责。
- 保留同步同事务事实的低延迟路径，同时让真实跨进程输入拥有可恢复 outbox。
- 用 transaction/ack/lease 证据证明 crash 后不会丢失或双计数。

## Non-Goals

- 不在本 change 中定义 portrait/read-model schema 或修改学生画像算法。
- 不把同事务内部调用强制改为事件，也不把每次内部调用再写一份 outbox。
- 不改变 Assessment 的官方结果、Arena official authority 或 Personalization 的 plugin ownership。
- 不执行生产 backfill、部署或 selector/cutover。

## Decisions

### 1. 一个 canonical ingestion application API

API 接收已通过 event contract 的 envelope 或受信任 application input，完成 normalization、authority/quality 校验、canonical identity、dedupe 和 `LearningFact` 持久化。caller 不得再自行组合 `routeEvent`、fact writer 和 snapshot enqueue；返回值包含事实结果和统一 projection trigger descriptor。

### 2. 按真实进程边界选择 transport

同事务 producer 直接调用 ingestion API，在同一数据库事务中写入事实及其必要的幂等 trigger intent；提交后由唯一 coordinator 调度 projection。真实跨进程 producer 先写一个 staging outbox，worker 领取后调用同一 API，事实与“已应用”状态在一个可重放事务中完成。禁止一个 producer 先 direct 写 fact 再为同一逻辑输入写 outbox。

### 3. Trigger 由事实结果统一派生

ingestion API 根据新建/修正/撤销事实及受影响 subject/class 计算一个 canonical trigger key，交给现有 durable materialization/request 机制。重复 trigger 合并但不抹掉更高 generation 或 revision；没有新事实的重复投递不重新推进 state watermark。processing watermark 与 state watermark 保持独立。

### 4. Ack-after-success 与可恢复失败

worker 使用 claim/lease、可见性超时或等价非破坏性读取。处理前不删除消息；只有 fact transaction、dedupe result 和 projection trigger intent 成功提交后才 ack。异常保持 pending/retry，超过策略进入带原因和输入 digest 的 terminal failure/dead-letter，可由授权 replay 恢复。失败不能覆盖上一条合格 current projection。

### 5. 批处理和 backfill 共享状态语义

`LearningEventBatch`、EvidenceOutbox、历史 backfill 和 direct path 通过同一个 application result 记录 `staged`、`deduplicated`、`applied`、`retryable_failed`、`terminal_failed` 等状态。批内部分无效时保留批次和每条失败证据；不得用“批已处理”掩盖事实分母损失。

## Risks / Trade-offs

- 事务中同时写事实和 trigger intent 会增加锁/重试复杂度，但比“事实成功、调度丢失”更可证明。
- lease/retry 可能产生重复调用，因此 dedupe 必须先于 projection trigger 并由数据库约束兜底。
- 旧 Redis 列表在迁移期仍可能有积压；必须先建立 drain/replay 证据，不能直接删除消息或队列。

## Migration Plan

先为 direct core path 和 worker 写 characterization/失败测试，再实现 API 与 transport adapter；迁移一个 producer，证明事实计数、dedupe 和 trigger 对齐。随后按 producer 分母迁移 Assessment、Personalization、secondary 和 backfill。旧 worker 只有在所有输入完成 drain/replay 且 retirement ledger 闭合后，才能由第六项 proposal 删除。

## Open Questions

- 具体 queue 实现使用现有 job system 的哪一种 lease/ack API，由实现阶段根据部署约束选择；禁止退回 destructive pop。
- staging outbox 与已有 EvidenceOutbox/`LearningMaterializationOutbox` 的物理复用边界需要在 schema/transaction review 中确认，不能形成平行状态机。

## Accepted P1 decisions

### 6. Ingestion preserves immutable anchors and all three server times

canonical ingestion 的输入结果必须保留 `sourceEventId`、适用时的 `sourceLogId`、canonical knowledge/resource/activity identity 及 `revision`/`captureRevision`，同时保留 `schemaVersion`、`decoderVersion` 和 `materializerVersion`。direct、staging outbox、correction、replay 和 backfill 都调用同一 API，并把这些 anchor 传入事实/transition/receipt；correction 只能新增引用原 anchor 的记录，不能更新原事实的 anchor。

API 区分可信 `trustedOccurredAt`、服务器接收时的 `receivedAt` 和事实事务成功提交的 `materializedAt`；客户端时间只进入 `reportedClientAt`。source registry 声明可信来源、clock-skew window 和 late policy；越界时间不得被静默修正为可信时间。乱序输入按 trusted occurrence、可信 source sequence 及 `sourceLogId`/`sourceEventId`/dedupe identity 稳定排序，不按 Redis 到达顺序排序。replay 不改原三类时间或 anchor；换 decoder/materializer 必须走显式 rematerialization，cross-revision 默认拒绝或走带 target revision、原因和授权 receipt 的显式 rebase。

### 7. Deterministic input and projection trigger

canonical input digest、trusted-set digest 和 projection trigger descriptor 必须由同一规范化 anchor/排序/归一值确定性生成。相同输入无论 direct、outbox、correction replay 或 backfill 的投递顺序如何，都得到相同 digest 和 effective trigger；materializer 版本变化只能生成显式 rematerialization output，不得伪装成旧 replay。processing watermark 与 state watermark 仍分离，重复 receipt 不推进 state watermark。

### 8. Decision B: transport/fact/failure/raw physical separation

ingestion transport/outbox 使用最小 allowlist：事件与版本、可信时间/`reportedClientAt`、非个人 producer/scope refs、partition/sequence/idempotency、物化所需 enum/normalized values、capture/decoder version、可选不可猜 `rawArtifactRef` 加 digest/expiry/access policy 和 delivery status。禁止 generic payload JSON、原始答案、自由文本、prompt、model/parser 原文、直接 user ID 与异常回显。

写入 LearningFact 的字段限定为最小 canonical/opaque `subjectRef`、稳定对象 identity、归一结果/置信度、时间、revision/source summary、materializer/status、revocation 和 governance receipt；不得存可恢复原文。failure/DLQ 只保存 stage、脱敏错误码/fingerprint、次数/时间/终态、artifact deletion status 和授权 operation ref，不保存完整异常、stack 或序列化事件。restricted raw artifact 默认关闭，并使用独立物理存储、加密 key、ACL、purpose/schema/digest/expiry metadata；其读取、replay、拒绝、删除只产生无原文 receipt，普通 queue/fact/consumer 权限不继承。

### 9. Retention, replay and sanitizer controls

transport 按 lifecycle 保留，默认 replay 72 小时、硬上限 7 天；成功载荷须在 24 小时内删除，terminal receipt 原子提交后才能删除；failure receipt 默认 30 天、硬上限 90 天；LearningFact 默认课程有效期加 365 天并受 governance profile/删除请求约束；approved raw 默认 24 小时、硬上限 7 天，未批准则关闭；public audit 仅最小聚合、默认 90 天。值是上限而非最低，唯一最低要求是不得静默丢未终态 transport。

replay 需 scope、purpose、ticket、短期高权限和双人或等价控制，并复用原 idempotency/schema/decoder/anchor。新 decoder 只能 rematerialize。旧 JSON 只经版本化 sanitizer 隔离读取；未知字段/version/digest/retention/ref 失效或 ACL 漂移时 fail closed。导出禁止 raw answer/prompt/model/parser text、可逆 user ID、raw artifact、token、地址、本机路径和可识别小样本；expiry 后须验证对象、索引、缓存、副本不可读并写 deletion receipt。
