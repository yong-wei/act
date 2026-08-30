## Context

通用路径中存在控制校正课程的目标、课次、资源和 Arena 标识判断；同时 `externalize-control-correction-personalization-plugin` 已规定 goal plugin 的 explicit `goalId` 和 canonical contracts。若直接在 Learning Record 增加更多课程分支，会继续扩大平台层耦合。adapter 必须是唯一课程特定映射入口，并与第三项 projection 的 source/revision/provenance 对齐。

## Goals

- 将课程知识和控制校正证据语义放在 course/plugin owner 内。
- 保持通用 Learning Record、learner state 和 read ports 的课程无关性。
- 让 Arena official authority、Personalization plugin interface、质量和隐私边界可验证。

## Non-Goals

- 不更改 Arena official scoring、submission authority、leaderboard 或控制仿真数值模型。
- 不把 course adapter 变成第二个事实库、projection trigger 或推荐算法。
- 不用关键词、资源标题或客户端字符串推断 goal/lesson/Arena 身份。
- 不执行生产迁移、部署、selector 或删除历史 facts/snapshots。

## Decisions

### 1. 显式 adapter contract

定义由 `goalId`/plugin ID、adapter schema version、course/release/capture revision、canonical lesson/resource identity 和允许的 Arena evidence references 组成的 adapter contract。registry 与 `externalize-control-correction-personalization-plugin` 共享，不创建平行 plugin discovery。generic Learning Record 只接受 adapter 返回的 normalized mapping，不反向读取课程表。

### 2. Mapping 和 authority 分离

adapter 可映射 control-correction goal、lesson、Arena task/resource 到受治理 evidence contribution，但不能决定 official score。Arena submission/result 继续由 Arena official authority 产生；LearningFact 记录 source/causation/quality 和辅助学习行为，冲突时 official authority 胜出并留下 conflict receipt。

### 3. 版本和失败语义

每条映射携带 course/release/capture revision 和 source identity。缺少显式 goal、lesson/Arena identity、adapter version、release match 或出现多重匹配时 fail closed，记录最小诊断和可恢复 migration failure；不以“unknown”映射到默认课程或零贡献。

### 4. Personalization 与 read-port 边界

Personalization 只消费 adapter 已授权的目标/掌握/quality/coverage/provenance 字段，继续使用既有 plugin interface。student/teacher/AI read ports 只得到角色允许的 normalized evidence；Copilot 不获得额外 course authority，仍由其 server-authorized context resolver 控制。

### 5. 纵向迁移后删除硬编码

先建立控制校正 producer、reducer、snapshot、consumer、backfill、report 和 test caller 分母，迁移一个真实 Arena/lesson vertical slice，再删除 generic 常量、关键词分支和兼容 facade。删除须有 zero-caller、revision-bound parity、privacy 和 official-authority receipts。

## Risks / Trade-offs

- adapter 缺失会让部分事实暂时 unavailable；这是可审计的 fail-closed 结果，不能用错误课程映射替代。
- release/capture revision 检查会拒绝旧映射，需要由 migration/backfill 明确重放，而不是在 runtime 静默跨版本。
- adapter 增加一个清晰的插件边界，但不会减少课程 owner 对其映射和测试的责任。

## Migration Plan

锁定现有硬编码输出和 official result 基线，定义 adapter contract，迁移一个 vertical slice 并核验 LearningFact/projection/Personalization parity。迁移其他 control-correction callers、backfills/reports 后，删除通用层硬编码和旧 facade。生产部署和 selector 由另行授权的 cutover 处理。

## Open Questions

- control-correction adapter 与现有 course resource registry 的精确注册位置需要实现阶段按现有公开 API 选择。
- Arena evidence reference 的最小字段和 retention 需与 Arena/domain reviewer 确认，不能扩大到原始答案或仿真内部载荷。

## Accepted P1 decision B at the adapter boundary

adapter 的输入/输出必须先经过最小 allowlist。传输仅允许显式 goal/plugin、adapter/schema/capture/release revision、canonical lesson/resource/activity identity、Arena reference、归一值/置信度、可信/服务器时间、opaque subject/scope refs、idempotency 和必要 materialization enum；可选 raw 只允许不可猜 `rawArtifactRef` 加 digest/expiry/access policy。禁止 generic payload JSON、原始答案、自由文本、prompt、model/parser 原文、直接 user ID、token 或异常回显。

adapter 不拥有 raw artifact 权限，也不把权限传给 LearningFact、Personalization、queue、consumer 或 public audit。获准 raw 片段必须在独立物理存储、加密 key 和 ACL 中，读取/replay/拒绝/删除只写无原文 receipt；failure/DLQ 只保留脱敏阶段、错误码/fingerprint、次数/时间/终态、artifact deletion status 和 authorized operation ref。旧 JSON 只能经版本化 sanitizer 隔离读取，未知字段/version/digest/ref 或 ACL 漂移 fail closed。

adapter 输出、LearningFact source summary 和 projection output 必须保留 `sourceEventId`、适用时 `sourceLogId`、canonical identity、revision/captureRevision、schema/decoder/materializer version 与 trusted set digest。direct、outbox、correction、replay、backfill 不得丢 anchor；相同输入按稳定排序产生相同 mapping/digest。换 decoder 走显式 rematerialization，cross-revision 默认拒绝或使用授权 rebase。

控制校正相关 transport 默认 replay 72 小时/最长 7 天，成功载荷 24 小时内删除，failure receipt 默认 30 天/最长 90 天，approved raw 默认关闭且批准后 24 小时/最长 7 天，public audit 仅最小聚合、默认 90 天。terminal/deletion receipt 原子完成前不得清理；导出不得包含原始答案、prompt、model/parser text、可逆 user ID、raw artifact、token、地址、本机路径或可识别小样本。
