---
change_id: reconcile-current-learning-record-write-boundary
claim_branch: reconcile-current-learning-record-write-boundary
series: modular-monolith-consolidation-2026-09
coupling_group: learning-record
execution_mode: stacked
base_branch: integration
required_branch:
depends_on:
  - capture-current-head-consolidation-delta
parent_issue:
blocked_by:
  - capture-current-head-consolidation-delta
blocking:
  - move-assessment-and-personalization-evidence-adapters-to-domain-owners
  - move-arena-and-teacher-evidence-adapters-to-domain-owners
risk: high
area: data-governance
openspec_path: openspec/changes/reconcile-current-learning-record-write-boundary
---

## Goal

按现有 Learning Record event contract 和 canonical ingestion API 核对当前所有写入路径，形成唯一、可审计的写边界。该变更只收敛事实来源与例外，不新建 event contract。

## Scope

- 清点在线路由、同事务领域调用、跨进程 worker/outbox、历史 backfill 和测试种子的 LearningFact 写入点。
- 为每个逻辑 producer 记录 owner、入口、transport、幂等身份、来源锚点、权限/隐私分类和删除条件。
- 明确 direct、staged/outbox、correction、replay、backfill 的边界；移除或封存已证明的重复写入调用。
- 保留 append-only facts、既有事件注册、outbox/transaction、watermark、隐私和官方结果权威。

## Out of Scope

- 重建或升级 `learning-record-event-contract`，新增事件总线或新事实格式。
- 改变 Assessment 评分、Personalization 画像/推荐、Arena 官方结果或教师报告语义。
- 在没有调用者、替代入口和回滚证据时批量删除 legacy 表、脚本或队列。

## Acceptance

- 生产、worker、脚本和测试写入点都有绑定当前 HEAD 的 owner/入口/幂等/锚点/隐私记录；未知或冲突记录阻断迁移。
- 同一逻辑动作只选择一个 direct 或 outbox 写入路径；并发、重试和 worker 崩溃不会产生第二个 LearningFact 或触发器。
- 内部同事务调用保持 typed application API，外部跨进程输入才使用既有 staging/outbox；backfill 使用显式授权模式且不改变在线 current pointer。
- `sourceEventId`、`sourceLogId`、canonical identity、revision、三类时间和 materializer/decoder 版本在所有路径保持不变并可追溯。

Proposal: local-only; GitHub Issue and production activation are intentionally deferred.
