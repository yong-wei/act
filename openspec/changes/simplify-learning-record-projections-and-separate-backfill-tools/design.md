## Context

C8 将 ingestion 稳定为单一、可追溯的写入 pipeline。当前 online projection 已有 immutable snapshots、qualified current pointer 和 role-safe read ports，但 `StudentEvidenceFeatureCache`、`StudentProfileSummary`、教师/Arena 汇总以及若干页面仍可能重复读取 facts；`scripts/db/backfill-*` 和历史 materialization 也与在线 runtime 共享实现入口。

本变更同时完成两个相互依赖的边界：对 projection/consumer 做行为保持简化，以及把 backfill 工具变成显式离线操作。它不重新定义 projection 算法，不删除历史数据，也不把既有受治理 cumulative migration 当作普通 backfill。

## Goals / Non-Goals

**Goals:**

- 在线页面和服务只通过既有 current projection/read ports 获取角色允许的结果，保留 revision、generation、watermark、coverage、freshness、confidence 和 status。
- 删除重复 raw aggregation、legacy fallback、无调用者缓存/工具；仍承担合法下游职责的 cache 继续作为声明式 projection。
- 为 backfill/materialization/report regeneration 建立独立入口、权限、dry-run/apply、frozen cutoff、operation identity 和最小 receipt。
- 用 before/after characterization 证明 status、隐私、时间、anchor、watermark、small-sample 和 pointer fence 不变。

**Non-Goals:**

- 不改 Learning Record event/ingestion contract、事实身份、projection 算法、评分、画像、推荐或 Arena official authority。
- 不删除 LearningFact、snapshot、transition、outbox、报告或已有专用 migration/cutover 工具。
- 不允许页面以 raw events/facts 作为 current projection fallback，也不进行生产 backfill、cutover 或 selector mutation。

## Decisions

### 1. Online authority is the existing fenced current projection

Student、Teacher、AI 和 Personalization 正常读取统一经过 `src/features/learning-record/projections/**` 的 current pointer/read ports。Projection unavailable/stale/partial 时原样返回状态和限制，不触发页面级 raw scan。下游 feature cache 只有在其输入、revision、watermark 和 role contract 明确时才能保留。

### 2. Backfill is a separate operational lane

历史工具使用独立 command/worker mode、授权 operation reference、冻结输入与 digest、dry-run first、per-input receipt 和明确 retention。普通 backfill 可以产生 append-only historical enrichment/correction，不能直接更新 online current pointer、伪造实时 trigger 或覆盖原始 anchor。

已有 cumulative attainment 等专用迁移若需要原子激活，必须继续使用其自己的 generation/fence/cutover receipt；它们不是本变更可放宽的例外。

### 3. Simplify after understanding every consumer

按 code-simplification skill 先查 caller/callee、git blame、路由/worker/脚本和测试，固定 online read 的 before output，再逐项移除重复聚合或 fallback。每次修改后比较相同输入下的 projection digest、status、watermark、角色字段和错误；若结果变化，停止并回到领域 contract。

### 4. Delete only proven legacy paths

legacy projection、cache 或工具只有在 zero required callers、replacement parity、privacy/authorization proof、backfill isolation 和 rollback condition 完整后才删除。rollback 仅恢复代码或 qualified pointer，不恢复 raw fallback 或宽泛权限。

## Risks / Trade-offs

- [Risk] 某个 cache 虽重复读取 facts，却是合法低延迟 read projection。→ 以 owner/consumer ledger、revision/watermark 和实际 caller 证明判断，未证实不删除。
- [Risk] backfill 与 online worker 共享模块导致权限绕过。→ 入口、operation identity、current-pointer guard、运行模式和 integration test 分离。
- [Risk] 删除 raw fallback 使 stale/unavailable 状态更显眼。→ 保留 truthful status、coverage、freshness 和可达的受控修复入口，不伪造 current。
- [Risk] 教师聚合泄露小样本或跨班级数据。→ 复用 Teacher read port、独立学习者计数和 class scope 负例测试。

## Migration Plan

1. 导入 C8 stable ingestion receipt，冻结 projection/consumer/backfill before 清单和行为基线。
2. 迁移普通 online consumer 到 current read ports，删除重复页面 aggregation/fallback，并逐项执行 code-simplification 验证。
3. 将历史脚本与在线 runtime 分离，加入 dry-run、frozen input、receipt、权限和 current-pointer negative guard。
4. 以零调用、parity、privacy、rollback 和工具隔离证据删除旧入口；运行 affected domain tests、typecheck、strict OpenSpec。

回滚恢复上一个通过 characterization 的 projection code/pointer；历史事实、snapshot、transition 和 backfill receipt 保持不变。

## Open Questions

- 需要在实现前从 C8 和调用图确定哪些 feature cache 是合法 downstream projection，哪些只是重复归约。
- 需要列出既有专用 migration/cutover 工具与普通 backfill 的精确分界，避免新 guard 阻断合法迁移或放宽其 fence。
