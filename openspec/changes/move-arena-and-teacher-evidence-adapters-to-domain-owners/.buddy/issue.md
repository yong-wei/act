---
change_id: move-arena-and-teacher-evidence-adapters-to-domain-owners
claim_branch: move-arena-and-teacher-evidence-adapters-to-domain-owners
series: modular-monolith-consolidation-2026-09
coupling_group: learning-record
execution_mode: stacked
base_branch: integration
required_branch:
depends_on:
  - reconcile-current-learning-record-write-boundary
parent_issue:
blocked_by:
  - reconcile-current-learning-record-write-boundary
blocking:
  - simplify-learning-record-ingestion
risk: high
area: data-governance
openspec_path: openspec/changes/move-arena-and-teacher-evidence-adapters-to-domain-owners
---

## Goal

将 Arena 官方证据写回和 Teacher 班级/报告证据适配归还各自领域 owner，删除 `data-governance` 中重复的业务编排，同时保持官方评测权威、班级隐私和报告 read model 输入。

## Scope

- Arena owner 负责 official submission/evaluation、preview boundary、compact evidence summary 和 Learning Record write request。
- Teacher owner 负责 class-scoped report/insight evidence read model、诊断交付和教师可见字段。
- 通过 C5 已确认的 canonical Learning Record ports 传递最小、版本化、可追溯的结果摘要。
- 迁移真实 routes、workers、scripts、reports 和 tests；按零调用者、parity、隐私、回滚证据删除旧 adapter。

## Out of Scope

- 改 Arena scoring/leaderboard/official submission、Simulation 数值模型或 Teacher 报告业务语义。
- 将 preview、练习、模型输出或教师预览提升为官方 LearningFact/任务完成。
- 搭建第二套 Learning Record event contract、改变 backfill 或删除历史事实/报告。

## Acceptance

- Arena 的官方/预览证据边界和 Teacher 的 class scope 均由领域 public API 负责，`data-governance` 不再是业务 authority。
- Arena official evidence、preview summary、Teacher report input 的 provenance、revision、dedupe、watermark 和 privacy 与迁移前一致。
- 教师请求只读取授权班级的 read model，独立学习者小样本抑制和已知零/不可用状态保持正确。
- 旧业务 adapter 只有在所有生产调用者迁移并通过 cross-class、preview/official、重复/崩溃和隐私负例后才删除。

Proposal: local-only; implementation is blocked until the C5 writer inventory is complete.
