---
change_id: move-assessment-and-personalization-evidence-adapters-to-domain-owners
claim_branch: move-assessment-and-personalization-evidence-adapters-to-domain-owners
series: modular-monolith-consolidation-2026-09
coupling_group: learning-record
execution_mode: stacked
base_branch: integration
required_branch:
depends_on:
  - complete-assessment-runtime-owner-migration
  - simplify-personalization-learner-state
  - reconcile-current-learning-record-write-boundary
parent_issue:
blocked_by:
  - complete-assessment-runtime-owner-migration
  - simplify-personalization-learner-state
  - reconcile-current-learning-record-write-boundary
blocking:
  - simplify-learning-record-ingestion
risk: high
area: data-governance
openspec_path: openspec/changes/move-assessment-and-personalization-evidence-adapters-to-domain-owners
---

## Goal

将 Assessment 与 Personalization 的证据适配职责归还各自领域 owner，删除 `data-governance` 中重复的业务编排，同时让 Learning Record 只提供既有 canonical writer/read ports。

## Scope

- Assessment owner 负责 attempt、scoring、review/provisional 状态和 assessment-to-evidence 映射。
- Personalization owner 负责 learner-state、path、recommendation/intervention 的证据读取、插件映射和写入请求。
- 通过 C5 已核对的 typed Learning Record ports 传递规范化证据，不在 adapter 中复制事件协议或事实存储。
- 迁移真实生产、worker、脚本和测试调用者；仅在零调用者、parity 和回滚证据成立后删除旧 adapter。

## Out of Scope

- 重写 Assessment 评分、题目审核/发布、Personalization 算法、路径资格或干预策略。
- 改变 LearningFact identity、事件 schema、watermark、隐私分类或 backfill 运行方式。
- 删除仍被历史报表、课外功能或受控 backfill 使用的旧表和兼容读取器。

## Acceptance

- Assessment 和 Personalization 的每个证据 adapter 都有唯一 owner、public API、输入/输出 provenance 与删除条件；`data-governance` 不再承担业务权威。
- Assessment durable attempt、题目快照、评分/审核状态和 LearningFact 写回保持幂等、并发安全与原有同步/异步语义。
- Personalization 只消费 Learning Record/Assessment read ports 与注册插件，缺失、低置信度、预览和旧版本证据保持显式，不读 raw Prisma。
- 旧路径删除后，相关路由、worker、脚本和测试无生产导入；历史事实、官方 Arena 结果和课程语义保持不变。

Proposal: local-only; implementation requires the C1/C4/C5 dependencies to be archived or otherwise proven complete.
