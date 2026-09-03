## Context

前置 change `separate-online-learning-record-from-backfill-tools` 已将历史操作和 online runtime 分开。当前目标 revision 的在线投影仍同时存在 fenced current projection、feature cache、profile summary、教师汇总和页面局部聚合；部分路径只是重复编排，部分 cache 可能仍是合法下游 read projection。

本变更是纯行为保持简化，不能借机重定义 backfill 操作合同、权限、receipt、projection algorithm 或领域 owner。删除集合必须由调用图和 before/after 证据决定。

## Goals / Non-Goals

**Goals:**

- 让 online projection/read-model 代码更直接，减少重复聚合、fallback、wrapper 和第二 authority。
- 保持 qualified current、immutable snapshot、pointer fence、revision/generation/watermark、coverage/freshness/confidence/status 和角色字段完全一致。
- 按 `code-simplification` skill 主动执行 Chesterton's Fence、逐项修改、逐项测试、before/after 对照和旧路径删除。
- 在最终 diff 中保留可回滚、可审计且不扩张权限的实现。

**Non-Goals:**

- 不修改 A 的 command/worker、operation identity、权限、frozen cutoff、receipt、retention 或 current-pointer 写合同。
- 不修改 Learning Record event/ingestion contract、事实 identity、projection algorithm、评分、画像/推荐语义或 Arena authority。
- 不把 cache、backfill、raw facts 或页面聚合变成新的长期权威。

## Decisions

### 1. One online projection expression, existing ports

普通页面、route、AI 和 Personalization 继续通过既有 role-safe current read ports 读取 qualified current。简化只合并等价 orchestration；不得让 consumer 直接读取 raw events/facts，也不得跳过 pointer fence、revision、watermark 或 status。

### 2. Explicit code-simplification protocol

实现前必须读取并执行 `/Users/YW/.agents/skills/code-simplification/SKILL.md`：先查 callers/callees、边界、git blame 与测试，判断每个 wrapper/cache/aggregator 的原因；记录 before 指标；一次只改一个等价点；通过回归后比较输出与副作用；确认无独立语义再删旧路径。

before/after 维度包括 projection/input/output digest、status/error、anchors/revision、generation/watermark、known-zero/missing/stale/unavailable、role scope、small-sample suppression、privacy 字段和 pointer movement。

### 3. Preserve caches only as declared downstream projections

`StudentEvidenceFeatureCache`、`StudentProfileSummary` 或类似 cache 若有合法 consumer、独立 freshness/coverage contract 和 revision-bound provenance，可继续作为下游 read projection；若只是第二主归约器或页面 fallback，才进入删除集。不能按文件名或代码行数决定。

### 4. Deletion and rollback are evidence-gated

每个删除必须证明零 required caller、替代 port parity、all-path canary、隐私/权限一致和 rollback 条件。回滚只恢复上一份已验证 code/pointer，不恢复 raw fallback 或 A 的 backfill 权限。

## Risks / Trade-offs

- [Risk] “重复”逻辑实际承载 stale/known-zero 或角色差异。→ 在 before/after 矩阵中逐项冻结状态和 payload，不等价则保留。
- [Risk] 合并 consumer 使 Teacher small-sample 或 AI scope 变宽。→ 复用既有授权/read port，并测试跨用户、跨班级和字段 allowlist。
- [Risk] 删除 cache 破坏低延迟合法 consumer。→ 先闭合 caller/owner/freshness/provenance 分母，未证明不删除。
- [Risk] 简化误触 A 的操作合同。→ 将 backfill command/worker、权限、receipt 和 current-pointer tests 列为不可修改边界。

## Migration Plan

1. 验证 A 已完成并冻结 online projection/read-model before snapshot。
2. 调用 code-simplification skill，按候选责任建立调用图、历史原因、before 行为和删除条件。
3. 一次完成一个等价简化；每项运行直接测试并比较完整 characterization，失败即停止该候选。
4. 删除通过证据门禁的旧聚合/fallback/wrapper/cache authority，保留所有合法 downstream projection 和 A 操作合同。
5. 在最终 revision 运行 projection/consumer/role/privacy/small-sample tests、typecheck、strict OpenSpec 和 diff check。

回滚恢复上一个行为等价的 online projection revision；不得重新启用 raw fallback 或修改 backfill operation authority。

## Open Questions

- A 的最终边界 receipt 是否已锁定所有 online projection pointer writers，需在实现前检查。
- 哪些 cache 仍有独立合法 consumer 由调用图决定；在证据不足时默认保留。
