## Context

仓库已有 `StudentCompetencySnapshot`、`StudentPortraitV2Snapshot`、`LearnerPortraitStateVersion`、`LearnerPortraitCurrentState`、`StudentEvidenceFeatureCache` 和 teacher/AI evidence readers。它们的历史版本、current pointer、cache 和页面聚合尚未统一成一个 publication contract。新的 ingestion trigger 能保证“何时需要投影”，但还不能保证候选结果不会倒退或越权覆盖 current。

## Goals

- 让 immutable historical snapshot、role-safe read model 和 current pointer 的职责可验证。
- 用 watermark/revision/input digest/generation/fence 解决乱序、并发、重放和 stale publish。
- 让所有下游只读受治理事实投影，并能表达 unknown、partial、stale、conflict 和 unavailable。

## Non-Goals

- 不重新设计画像维度、风险算法、可信过滤器或学生 evidence status 的既有业务定义。
- 不在本 change 中迁移或删除历史事实、snapshot、cache，也不执行生产 backfill/selector。
- 不复制 ground-evidence-copilot 的上下文解析和权限；不把 projection 变成写回官方分数的入口。

## Decisions

### 1. Fact, snapshot and read model 分层

`LearningFact` 保留 append-only 事实与质量/来源身份。immutable snapshot 保存某次计算的完整版本和输入证据；role-specific read model/current pointer 只发布消费所需字段。cache 是可重建 read projection，不是新的事实源。raw event 仅用于审计、debug、迁移和 drilldown。

### 2. Publication envelope 与 qualification

候选 projection 必须携带 subject/scope、source fact watermark、processing watermark、state watermark、calculation/revision、generation、input digest、coverage、freshness、confidence、qualification/status 和生成时间。只允许满足 trusted fact、scope/privacy、schema 和 minimum evidence 条件的候选成为 qualified current。

### 3. Fence 下原子 current pointer

发布事务先写 immutable version，再以 subject、generation、watermark、revision 和 cutover fence 条件 compare-and-set current pointer。旧候选、digest 不同的同版本冲突、越权 scope 或不合格结果不得覆盖 current。current 与 version 的关联必须能在一事务或等价 durable receipt 中验证。

### 4. Stale/conflict/failure 语义

投影失败、证据不足或输入落后时保留上一条 qualified current，并把当前 read port 标记 `stale`、`partial`、`unavailable` 或 `conflict` 及原因/时间。没有 previous qualified current 时返回明确 unavailable，不扫描 raw events 进行隐式补偿。可恢复重试不得生成新的事实。

### 5. Role projection 与小样本

student、teacher、AI 和 Personalization 由同一 publication contract 生成最小字段，按已授权 subject/tenant/class scope 投影。教师聚合的小样本门禁按独立学习者计数；学生 projection 不带 teacher/admin 数据；AI/Copilot 只收 server-authorized safe context；Personalization 只收目标/掌握区分、confidence、coverage、provenance 等必要特征。

## Risks / Trade-offs

- pointer fence 会拒绝部分乱序候选，代价是短暂 stale；这比静默倒退或混合版本更安全。
- 分离 snapshot/read model 增加存储和 receipt，但允许角色最小化、独立重建和可审计回滚。
- 旧页面短期仍可能依赖 raw 聚合；消费者 proposal 必须先完成 characterization，再删除调用者。

## Migration Plan

先为现有 portrait/cache/teacher/AI readers 记录输入、watermark、字段和权限基线，再为一个真实 projection writer 添加 publication envelope 与 atomic pointer test。完成一个 student/teacher vertical slice 后迁移其余 consumers；第六项仅在所有 writer/reader/replay/report 分母闭合后退休旧 projection。

## Open Questions

- 既有 `LearnerPortraitCurrentState` 与 feature cache 的 pointer/freshness 字段如何映射，由实现阶段按现有 schema 选择最小兼容扩展。
- conflict receipt 的 retention 与公开错误文案需要和全局 evidence retention policy 一起确认。

## Accepted P1 decisions

### 6. Publication carries immutable input anchors

每个 immutable snapshot、current read model 和 publication receipt 必须保留 contributing facts 的 anchor set：`sourceEventId`、适用时的 `sourceLogId`、canonical knowledge/resource/activity identity、`revision`/`captureRevision`、`schemaVersion`、`decoderVersion` 和 `materializerVersion`。projection 只能引用已接受的 anchor；correction、replay、backfill 或显式 rematerialization 产生新 derived version 并保留原 anchor，不得在原 snapshot 上改写。

publication 的 `trustedOccurredAt`、`receivedAt`、`materializedAt` 与 `reportedClientAt` 语义必须沿用 event/ingestion contract。trusted set、稳定排序、input digest 和 projection output 对同一 anchor/revision 输入必须确定性一致；乱序、延迟和重复只影响 status/receipt，不得改变历史时间或 anchor。decoder/materializer 变更必须标注 rematerialization，cross-revision 默认拒绝或采用有授权的显式 rebase。

### 7. Decision B at the projection boundary

projection transport 仅接收 allowlisted normalized values、anchor/version/time refs、opaque subject/scope refs、digest、generation/revision、coverage/confidence/status 和 materialization metadata。它不得把通用 payload JSON、原始答案、自由文本、prompt、model/parser 原文、直接 user ID 或异常回显带入 snapshot/read model。

restricted raw artifact 默认不参与 projection；若经批准，只传不可猜 `rawArtifactRef` 和 digest/expiry/access policy，原文在独立物理存储、加密 key 和 ACL 中，普通 projection/consumer/queue 权限不继承。failure/conflict/stale receipt 只保留脱敏 code/fingerprint、stage、时间、状态、artifact deletion status 和 operation ref。projection/export 不能恢复 raw 或可逆 user identity。

### 8. Retention and deterministic rematerialization

projection 依赖的 transport、成功载荷、failure receipt、approved raw artifact 和 public audit 遵守 hard upper bounds：默认分别为 replay 72 小时（最长 7 天）、成功载荷 24 小时、failure 30 天（最长 90 天）、approved raw 24 小时（最长 7 天，默认关闭）和最小 public audit 90 天。LearningFact 默认按课程有效期加 365 天保留，并受 governance profile/删除请求约束；snapshot/history 不得因 projection refresh 删除。terminal/deletion receipt 必须原子提交后才能清理。相同 trusted set 的 rematerialization 必须显式记录 decoder/materializer version 并产生确定性 output。
