## Context

`src/lib/data-governance/event-protocol.ts` 的事件形状同时服务客户端入口和服务器处理；`event-types.ts` 与数据库 `EventDictionary` 也存在重复登记。`src/app/api/interactive/events/route.ts`、event buffer 和 worker 对 core/secondary 的处理方式不同，不能作为后续 fact ingestion 的稳定契约。事件协议必须先划清“外部事实输入”和“同事务内部应用调用”，否则新入口会再次出现 direct 与 outbox 双写。

## Goals

- 让事件可版本化、可鉴别、可追溯、可去重和可按角色授权。
- 让服务器成为身份与作用域真源，并保留旧数据的可解释迁移路径。
- 让后续入口能以 registry 和 characterization ledger 验证完整 producer 分母。

## Non-Goals

- 不在本 change 中写 LearningFact、snapshot 或 read model。
- 不把每个内部 service call、数据库写入或页面点击都包装成事件。
- 不改变 Arena official authority、Assessment outbox 或 Personalization plugin 的所有权。
- 不执行生产回放、数据迁移、部署或 selector/cutover。

## Decisions

### 1. Registry 是协议真源，数据库字典是投影

维护一个带 `discriminator`、`schemaVersion`、`sourceVersion`、`action`、privacy classification、authority、payload schema 和 owner 的 registry。`EventDictionary` 只保存可查询投影，不能与代码中的 registry 形成第二套可变真源。未知 discriminator/version、缺少必需 schema 或 authority 的事件直接拒绝。

### 2. Envelope 分离身份、因果和业务载荷

事件信封包含不可变 `eventId`、contract/discriminator/version、`occurredAt`、服务器派生 subject/tenant/scope、source/action、causation、dedupe 和最小业务 payload。`causationId` 连接一次受信任上游事实，`dedupeKey` 表示逻辑一次性处理；二者不能从任意 payload 字段猜测。客户端提供的 user、role、tenant、course 或 authority 仅作为待校验提示，不能成为最终值。

### 3. Scope 与 privacy 是入口门禁

入口根据认证会话、服务器已知课程/班级关系和 producer authority 派生 scope。registry 为字段标记 public、student-private、teacher-scoped、restricted 等 classification，并规定最小必要投影。原始答案、prompt、模型输出、用户标识和未授权 teacher 数据不能进入不匹配的事件或公开报告。

### 4. Legacy adapter 只承担兼容，不扩张语义

旧事件通过显式 adapter 映射为新 envelope，保留 `legacy` source、原始版本和迁移批次标记；无法安全推导 subject、scope、causation 或 dedupe 时拒绝并进入可恢复失败记录。adapter 不改变历史事实，也不为内部调用生成新的事件。

### 5. Characterization 先于迁移

建立 owner/current route/API/model/event/script/test/caller 清单，逐一记录行为、权限、payload、计数口径、失败语义和删除条件。至少覆盖 interactive route、event buffer/worker、Assessment/Personalization outbox、Arena authority、backfill、report 和 active ground-evidence-copilot consumer。这个分母是后续 ingestion、consumer 和 retirement 的共同台账，不另建平行清单。

## Risks / Trade-offs

- 严格 registry 可能暴露历史事件缺失字段；优先进入 compatibility failure/review，而不是猜测身份或静默补零。
- registry 与 `EventDictionary` 需要同步发布；版本化投影和启动校验应使漂移 fail closed。
- 现有调用者短期仍需适配器；台账必须给出每个适配器的删除条件，避免兼容层永久化。

## Migration Plan

先冻结 characterization 和 registry fixtures，再让一个真实 producer 走新 envelope 并验证旧事件 adapter。随后由 ingestion proposal 迁移物化路径；本 change 不启用生产 selector。只有所有 producer 的分母、scope/privacy 测试和兼容失败证据闭合后，后续 change 才可删除旧协议分支。

## Open Questions

- `EventDictionary` 投影的 schema version 是否需要与数据库 migration 一起发布，由实现阶段结合现有部署脚本决定。
- legacy failure 的审计保存期限和可重放入口需要与数据治理 retention policy 对齐。

## Accepted P1 decisions

### 6. Immutable anchors and temporal semantics

每个被接受的事件及其后续 fact、correction、replay 和 backfill 必须保留不可变 anchor 集合：`sourceEventId`，适用时的 `sourceLogId`，canonical knowledge/resource/activity identity 及其 `revision`/`captureRevision`，以及 `schemaVersion`、`decoderVersion` 和 `materializerVersion`。direct、outbox、correction、replay、backfill 只能新增明确的派生记录或 transition，不能覆写原 anchor；correction 通过新 correction identity 引用原 anchor。

时间字段分为受信任的 `trustedOccurredAt`、服务器写入的 `receivedAt` 和成功物化提交时的 `materializedAt`。客户端时间只能保存为 `reportedClientAt`，不能提升为事实发生时间或排序依据。registry 必须为每种 source 声明 trust class、允许的 clock-skew window 和缺失/越界处理；不满足来源或偏差门禁时标记可审计的 late/clock-skew failure 或拒绝，不以客户端时间补齐。乱序输入按 trusted occurrence 与 source sequence 排序，并使用 `sourceLogId`/`sourceEventId`/dedupe identity 的稳定 tie-breaker；不得依赖到达顺序或本机时间产生不同结果。

同一输入的 anchor、trusted set、input digest 和 projection output 必须确定性一致。replay 不改变三类服务器时间或 anchor；更换 decoder/materializer 必须创建显式 rematerialization 记录，保留旧版本并记录新版本，不能伪装成原始 replay。跨 revision/captureRevision 默认拒绝；只有带授权、原因、目标 revision 和 rebase receipt 的显式 rebase 才能继续。

### 7. Decision B: minimum allowlist and physical raw-artifact isolation

采用 trust-boundary allowlist。transport/outbox 只能携带事件与 contract version、受信时间/`reportedClientAt`、非个人的 producer/scope refs、partition/sequence/idempotency、物化所需 enum/normalized value、capture/decoder version、可选的不可猜 `rawArtifactRef` 加 digest/expiry/access policy，以及投递状态。禁止通用 payload JSON、原始答案、自由文本、prompt、模型原文、直接用户标识和异常回显。

LearningFact 只保存最小 canonical 字段、opaque `subjectRef`、稳定对象 identity、归一结果/置信度、时间、revision、source summary、materializer/status、revocation 和 governance receipt；它必须不能恢复原文。failure/DLQ receipt 只保存 stage、脱敏 error code/fingerprint、次数/时间/终态、artifact deletion status 和授权 operation ref，不保存完整异常、stack 或序列化事件。

restricted raw artifact 默认关闭，且必须与 transport、fact、failure 和 public audit 使用物理存储、独立加密 key、ACL 和审计边界。获准时只保存最小片段；metadata 必须包含 digest、purpose、schema、expiry，读取/replay/拒绝/删除都写无原文 receipt，普通 consumer/queue/fact 权限不得继承 raw 权限。新写入先过 allowlist；旧 JSON 只能经版本化 sanitizer 隔离读取。未知字段/version/digest/retention/ref 失效或 ACL 漂移时 fail closed；回滚不得恢复广泛 raw JSON 或 ACL。

### 8. Retention, replay and export are hard upper bounds

Retention 值是上限而非最低要求：non-terminal transport 按生命周期保留，默认 replay 72 小时、最长 7 天；terminal receipt 原子化后才可删除，成功载荷须在 24 小时内删除；LearningFact 默认课程有效期加 365 天并受治理 profile/删除请求约束；failure receipt 默认 30 天、最长 90 天；restricted raw 默认关闭，批准后默认 24 小时、最长 7 天；public audit 只保留最小聚合、默认 90 天。唯一最低不变量是不得静默丢弃未终态 transport。

replay 必须绑定 scope、purpose、ticket，使用短期高权限及双人或等价控制，并复用原 idempotency、schema、decoder 和 anchor。换 decoder 只能走显式 rematerialization。导出禁止原始答案、prompt、model/parser 原文、可逆 user id、raw artifact、token、地址、本机路径及小样本可识别信息；到期后生成 deletion receipt，并验证对象、索引、缓存和副本均不可读。
