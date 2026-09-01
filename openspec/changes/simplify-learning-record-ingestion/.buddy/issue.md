---
change_id: simplify-learning-record-ingestion
claim_branch: simplify-learning-record-ingestion
series: modular-monolith-consolidation-2026-09
coupling_group: learning-record
execution_mode: stacked
base_branch: integration
required_branch:
depends_on:
  - move-assessment-and-personalization-evidence-adapters-to-domain-owners
  - move-arena-and-teacher-evidence-adapters-to-domain-owners
parent_issue:
blocked_by:
  - move-assessment-and-personalization-evidence-adapters-to-domain-owners
  - move-arena-and-teacher-evidence-adapters-to-domain-owners
blocking:
  - simplify-learning-record-projections-and-separate-backfill-tools
risk: high
area: data-governance
openspec_path: openspec/changes/simplify-learning-record-ingestion
---

## Goal

在 C6/C7 完成业务 adapter 迁移后，对 canonical Learning Record ingestion 做行为保持的简化，删除重复 envelope/parser、幂等键解析和内部 schema guard 路径，同时保持既有 contract 与可靠交付语义。

## Scope

- 先记录 ingestion 在成功、重复、冲突、失败、重试、乱序、版本漂移和隐私拒绝场景下的 before 行为。
- 将 direct 与 staged/outbox 输入收敛到一个清晰的归一化、dedupe、anchor/time、allowlist 和 trigger pipeline。
- 删除只增加转发/重复校验且无独立语义的旧 helper、wrapper、parser 和测试；保留仍有业务或审计价值的命名边界。
- 每项简化主动遵循 code-simplification skill：先理解调用者与原因，逐项修改、逐项测试、比较 before/after，再删除旧路径。

## Out of Scope

- 迁移 Assessment/Arena/Teacher/Personalization adapter；这些由 C6/C7 完成。
- 修改 event discriminator/schema、LearningFact 身份、dedupe 语义、outbox/transaction、watermark、隐私或 retention contract。
- 以“代码更短”为理由移除错误处理、审计、回滚、raw 隔离或任何客户端/服务端边界。

## Acceptance

- canonical ingestion 只有一个可解释的 normalized input path，direct/outbox 共享相同 anchors、times、dedupe、allowlist、trigger 和错误分类。
- before/after characterization 在完整状态矩阵上保持输出、错误、side effects、排序和幂等；所有既有测试无需因行为改变而放宽。
- 重复 envelope/parser、幂等键和内部 guard 仅在确认无独立语义和零调用者后删除，架构复杂度净下降且不新增 facade。
- transaction commit、outbox recoverability、ack-after-success、隐私最小化和审计证据在 kill/restart、并发、重试场景下保持成立。

Proposal: local-only; this is an implementation simplification after C6/C7, not a new Learning Record contract.
