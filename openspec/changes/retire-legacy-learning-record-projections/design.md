## Context

旧路径包括 Redis list buffer/`RPOP` worker、event-batch materializer、重复 fact writer、raw event page aggregation 以及 legacy snapshot/projection services。前四项 proposal 负责建立 contract、ingestion、publication 和 consumer migration；本 change 只定义何时可以安全删除。历史 LearningFact、snapshot、transition 和 evidence receipts 是审计与回放材料，不属于可清理的 legacy runtime。

## Goals

- 将“可以删除”变成 revision-bound、可审计、可回滚的门禁，而不是代码搜索后的主观判断。
- 关闭所有 producer/consumer/worker/backfill/report 旧路径，消除双物化、破坏性队列和 raw fallback。
- 保留历史证据、current rollback 和官方权威边界。

## Non-Goals

- 不在本 change 中迁移或删除生产数据，不物理清理历史 facts/snapshots。
- 不部署、不切换 selector、不改变 runtime release order。
- 不删除 ground-evidence-copilot 的 server-authorized context、Arena official result、Assessment/Personalization owner contracts。
- 不将 audit/debug/migration 的必要 raw access 混入正常页面或 read port。

## Decisions

### 1. Retirement ledger 是唯一删除门禁

台账按 producer、consumer、worker、backfill、report 和 test 分母记录 current route、replacement、owner、last revision、watermark/digest receipt、privacy validation、zero-caller evidence、rollback and deletion condition。未闭合项即 fail closed；“新路径已经存在”不等于旧路径可删。

### 2. 迁移、回放和水位先行

在停止旧 worker 前冻结可比基线，完成允许的 backfill/replay，比较 accepted/deduplicated/failed denominators、LearningFact identity、projection revision、processing/state watermark 和 input digest。只允许修复差异后再 drain；不通过 dual write 维持第二事实真源。

### 3. Redis queue 的删除顺序

先停止旧 producer 写入并确认 canonical ingestion 已接管，再以非破坏性方式 drain/replay 已有列表，确认每条消息有 applied/duplicate/failure receipt 和水位闭合；最后删除 RPOP consumer、list key/TTL 逻辑和相关脚本。任何未确认消息都必须保留或进入授权 replay，不能 `DEL` 丢弃。

### 4. 删除重复物化和 raw aggregators

canonical ingestion/trigger 与 current projection 成为唯一正常物化路径后，删除 duplicate materializer、legacy projection service 和页面 raw aggregator。保留历史查询仅限明确授权的 audit/debug/migration/drilldown operation，并要求 purpose、时间窗、scope 和 revision receipt。

### 5. 回滚只回滚代码/pointer，不回滚历史事实

发布失败或发现 parity 缺口时，停止 retirement、恢复上一条 qualified current 或旧运行代码，并保留失败/冲突 receipt。不得删除或重写已接受的 LearningFact、snapshot、transition 或 official result 来“回滚”。

## Risks / Trade-offs

- 删除旧 queue 可能暴露隐藏 producer；因此 producer zero-write、运行时指标和静态 caller 证据必须同时存在。
- replay parity 可能因历史 bug 不一致；差异需要归因并显式记录，不可用旧 raw aggregation 静默补偿。
- 保留历史审计数据有存储成本，但保障 revocation、审查和可重建性。

## Migration Plan

先完成第四、第五项的 consumer/adapter closure，再生成 retirement ledger 和 baseline receipts；按 queue、materializer、raw aggregator、legacy service 的顺序逐项 gated deletion。每项删除后运行直接回归和受影响域测试，最终在 intended revision 做 broad verification；本 proposal 不执行生产操作。

## Open Questions

- 旧 Redis 列表 drain/replay 的具体运维工具和 retention 由部署 owner 定稿；实现不可直接使用 destructive deletion。
- legacy projection 的历史只读查询是否需要独立 audit role，需要和数据治理/安全 reviewer 确认。

## Accepted P1 decision B for retirement

退休前必须证明旧 raw JSON、Redis list、batch/outbox payload 和 failure/DLQ 都已经经过版本化 sanitizer、allowlist、retention 和 deletion receipt 处理。删除旧 queue、materializer 或 projection 不得先删掉仍处于 non-terminal 的 transport 或唯一 raw artifact；未终态 transport 的最低要求是可恢复，不能静默丢失。成功载荷在 24 小时内删除，failure receipt 默认 30 天/最长 90 天，transport replay 默认 72 小时/最长 7 天，approved raw 默认关闭、批准后 24 小时/最长 7 天，public audit 只保留最小聚合、默认 90 天。

raw audit artifact 与 transport、LearningFact、failure 和 public audit 必须物理隔离，使用独立加密 key、ACL 和审计。普通 queue/fact/consumer 权限不得继承 raw 权限；普通 export 不得输出原始答案、prompt、model/parser 原文、可逆 user ID、raw artifact、token、地址、本机路径或可识别小样本。到期/删除须生成无原文 receipt，并验证对象、索引、缓存和副本不可读。

删除验收覆盖所有路径：递归 forbidden-field/编码/异常回显扫描、mixed schema/version、unknown digest/ref/retention/ACL、全路径 canary、kill/restart/duplicate/out-of-order、terminalization 原子性、ACL/replay 审计、Postgres/Redis/queue/deployment integration 和删除后 unreadability。回滚只能恢复代码或上一条 qualified pointer，不得恢复广泛 raw JSON 或 ACL，也不得改写历史 facts/snapshots/official results。
