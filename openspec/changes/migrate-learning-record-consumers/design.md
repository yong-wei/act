## Context

现有 `/api/student`、`/api/teacher`、AI context、Personalization state、feature cache 和若干页面 helper 读取路径不一致。部分 route 直接扫描事件或把 URL hints 当证据；ground-evidence-copilot change 已规定服务器解析 authenticated student 的 governed evidence，并禁止写回 LearningFact/profile。消费者迁移必须将这些能力接到第三项 read ports，而不是再建一个“通用 facade”掩盖旧聚合。

## Goals

- 给各角色一个稳定、最小、可追溯且能表达 stale/unknown 的 read boundary。
- 迁移所有实际 caller 并删除页面级 raw aggregation，保留审计和迁移所需的受限 raw access。
- 在不改变 Copilot、Arena、Assessment 和 Personalization ownership 的前提下统一证据口径。

## Non-Goals

- 不重新定义 projection、学习状态 reducer、推荐算法或 AI 提示词业务。
- 不把 read port 作为绕过权限的后门；不接受客户端身份、证据、分数或 teacher scope。
- 不复制 ground-evidence-copilot 的 context resolver、权限或 writeback contract。
- 不执行生产数据迁移、部署、selector 或删除历史 facts/snapshots。

## Decisions

### 1. Ports 按消费角色定义最小数据

Student port 返回安全状态、coverage/freshness/confidence、有限 evidence refs 和真实 next action；Teacher port 先验证 class/tenant scope，并按独立学习者执行小样本抑制；AI port 返回私有但最小化、带 provenance 的 governed context；Personalization port 返回 target/mastery 区分、质量、coverage 和可用特征。所有 port 都携带 projection revision/watermark/status。

### 2. Server scope 是唯一授权入口

route 从认证会话和服务端关系派生 subject/tenant/class/role。页面 query、URL hints、assignment/intent 或客户端传入的 studentId 只能作为受限导航提示，不能扩大证据范围。读 port 在字段投影前执行授权和 privacy classification。

### 3. Copilot 采用既有 resolver，不复制合同

`ground-evidence-copilot` 仍由服务器根据 authenticated student 读取 governed evidence；`source`、`assignment`、`intent` 只帮助选择入口或目标。迁移只替换底层 evidence read port，并保留 evidence status/coverage/freshness/confidence/limitations、advisory-only 和 ordinary Copilot compatibility。

### 4. Raw aggregation 只允许受限运维场景

正常页面和 AI/Personalization runtime 禁止扫描 raw events。audit/debug/migration/drilldown 需明确 authority、purpose、时间窗和输入 revision，并记录受限 receipt；生产 consumer 不能以 raw fallback 绕过 stale/unavailable 语义。

### 5. 纵向迁移和删除以分母为准

先选择一个 student 或 teacher vertical slice，做 parity、privacy 和 failure characterization；再迁移其余 API/page/AI/plugin callers。每个旧 helper/aggregator 只有在 `rg`/codegraph caller 清单为零、替代 port receipt 存在且报告/backfill 已对齐后才可删除。

## Risks / Trade-offs

- 稳定 port 可能短期减少旧页面可见字段；应返回 truthful unavailable/limited，而不是扩大权限或重启 raw 聚合。
- 统一 projection revision 可能显现各 consumer 的历史计数差异；差异要记录为 characterization，而非在 port 中隐式修正。
- AI context 最小化会降低模型可见细节，但能保持 server authorization 和隐私不变量。

## Migration Plan

锁定 consumer 分母和当前输出快照，迁移一个 student-safe vertical slice，再迁移 teacher scoped、AI 和 Personalization。ground-evidence-copilot 在其 active change 完成后接入同一 port，保留其 contract。完成全部 reports/backfills 的 read path 对齐后，提交旧 aggregator/reader 删除；不在本 change 激活生产 selector。

## Open Questions

- AI port 的受限字段集合需要与现有 `konling-context` 和 workshop evidence owner 在实现审查中定稿。
- teacher small-sample threshold 继续沿用现有 governed policy，还是由 read-port contract 显式引用，需和数据治理 reviewer 确认。

## Accepted P1 decision B at consumer boundaries

read port 的输入和输出采用最小 allowlist。consumer 只获得 projection 的 opaque subject/scope refs、稳定对象 identity、归一值、可信/服务器时间、revision/captureRevision、source summary、status、coverage、freshness、confidence 和允许的 provenance；不得获得通用 payload JSON、原始答案、自由文本、prompt、model/parser 原文、直接 user ID、异常/stack 或 token。页面和 AI runtime 不可通过 raw fallback 绕过 projection 状态。

restricted raw artifact 默认关闭，且与 queue/transport、LearningFact、failure/DLQ、public audit 和普通 consumer 使用独立物理存储、加密 key、ACL。即使 Copilot 或受限 audit 需要 raw，也只接收不可猜 `rawArtifactRef`、digest、purpose、schema、expiry/access policy，读取/replay/拒绝/删除均只返回无原文 receipt；普通 consumer 权限不得继承。ground-evidence-copilot 继续使用既有 server-authorized context resolver，不复制权限或扩大 context。

所有 consumer 导出遵守硬上限和禁止项：不得导出原始答案/prompt/model/parser text、可逆 user ID、raw artifact、token、地址、本机路径或可识别小样本。成功载荷 24 小时内删除，failure receipt 默认 30 天/最长 90 天，approved raw 默认 24 小时/最长 7 天且默认关闭，public audit 仅最小聚合、默认 90 天；到期先写 deletion receipt，再验证对象、索引、缓存和副本不可读。旧 JSON 只能由版本化 sanitizer 在隔离运维路径读取。
