---
change_id: simplify-learning-record-projections-and-separate-backfill-tools
claim_branch: simplify-learning-record-projections-and-separate-backfill-tools
series: modular-monolith-consolidation-2026-09
coupling_group: learning-record
execution_mode: stacked
base_branch: integration
required_branch:
depends_on:
  - simplify-learning-record-ingestion
parent_issue:
blocked_by:
  - simplify-learning-record-ingestion
blocking: []
risk: high
area: data-governance
openspec_path: openspec/changes/simplify-learning-record-projections-and-separate-backfill-tools
---

## Goal

在 C8 稳定 ingestion 后，简化 Learning Record current projection/consumer 路径，并把历史 backfill 工具与 online runtime 分离，避免页面重复聚合或历史操作污染在线 current pointer。

## Scope

- 以既有 fenced current projection、immutable snapshot 和 role-safe read port 为 online 唯一读取路径。
- 删除已证明重复的页面 raw aggregation、legacy fallback、废弃缓存和无调用者回填入口；仍被 canonical consumer 使用的 cache 保留为下游 read projection。
- 将 `scripts/db/backfill-*`、历史 materialization 和报告 regeneration 放入显式 dry-run/apply、冻结 cutoff、operation identity、最小权限和 receipt 的离线边界。
- 每项简化按 code-simplification skill 锁定 before/after 行为、逐项验证并清理本次产生的旧路径孤儿。

## Out of Scope

- 改变 Learning Record event/ingestion contract、事实身份、projection 算法、评分/画像/推荐语义或 Arena 官方 authority。
- 删除历史 LearningFact、snapshot、transition、outbox、报告或受治理 cumulative migration；已有显式 cutover contract 的迁移仍按其自身规范执行。
- 让 backfill 变成在线 writer、让页面以 raw facts 重建画像，或新增第二套 current pointer/read model。

## Acceptance

- 在线 student、teacher、AI 和 Personalization consumer 只经稳定 role-safe read port 读取匹配 revision/generation/watermark 的 qualified current；缺失时返回 truthful status，不 raw fallback。
- backfill 工具与在线进程在入口、授权、运行模式、输入 cutoff、receipt 和 current-pointer 写权限上分离；普通 dry-run/apply 不影响 online current 或 outbox。
- before/after characterization 保持 known-zero、missing、partial、stale、unavailable、privacy、small-sample、provenance 和 watermark 语义；未证明的 cache 不删除。
- 旧聚合器/回填入口只有在 zero caller、replacement parity、删除/保留证据和 rollback 条件成立后才移除，且架构复杂度净下降。

Proposal: local-only; no production backfill, cutover or selector mutation is authorized by this proposal.
