---
change_id: audit-remediation-platform-recovery-deeplink-contracts
claim_branch: audit-remediation-platform-recovery-deeplink-contracts
series: product-design-audit-leftovers
coupling_group: product-design-audit-leftovers
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/audit-remediation-platform-recovery-deeplink-contracts
risk: medium
area: platform-contracts
---

## Goal

关闭坏 ID、失效对象、权限边界、课堂码、raw id 暴露和 API/UI 错误语义不一致的剩余审计问题。

## Scope

- 定义并应用跨路由的 invalid/missing/unauthorized/stale/degraded 恢复状态。
- 要求 API 与 UI 对 no-match、bad id、missing context 和 unsupported method 使用同一语义。
- 降低全局 AI/浮动工具在错误页的优先级，保证恢复动作是第一任务。

## Out of Scope

- Implementing unrelated active SAR/Source Pack/RAG changes.
- Closing audit findings not explicitly covered by validation evidence.
- Replacing existing shared status, ledger, or governance primitives with a parallel system.

## Acceptance Checklist

- [ ] AC-1: 未关闭恢复/deep-link finding 被映射到具体学生、教师、管理员、Arena、adaptive 和 resource 路由族。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.
- [ ] AC-2: 已知坏 deep link 渲染产品恢复状态，而不是默认 404、raw id、静默重定向或正常进度。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.
- [ ] AC-3: API 与 UI 对 no-match、bad-id、missing-context 和 unsupported-method 使用一致语义。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.
- [ ] AC-4: 错误页优先展示恢复动作，而不是让全局 AI 或浮动工具成为主操作。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.
- [ ] AC-5: 代表性学生、教师、管理员、Arena 和 adaptive 路由通过验证。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.

## Tasks

- [ ] Task 1: Inventory bad route and API/UI mismatch findings across student, teacher, admin, Arena, adaptive, and resource routes.
  Covers: AC-1
  Acceptance: the implementation evidence demonstrates this task outcome without closing unrelated findings.
  Evidence: code/test/report diff or browser/DOM capture produced during apply.
  Reviewer Check: confirm the evidence satisfies AC-1 and no unchecked AC was self-approved by the implementation agent.
- [ ] Task 2: Introduce or reuse route recovery view models and apply them to highest-risk bad id/deep-link paths.
  Covers: AC-2, AC-4
  Acceptance: the implementation evidence demonstrates this task outcome without closing unrelated findings.
  Evidence: code/test/report diff or browser/DOM capture produced during apply.
  Reviewer Check: confirm the evidence satisfies AC-2, AC-4 and no unchecked AC was self-approved by the implementation agent.
- [ ] Task 3: Align API no-match and unsupported-method responses with UI recovery states.
  Covers: AC-3
  Acceptance: the implementation evidence demonstrates this task outcome without closing unrelated findings.
  Evidence: code/test/report diff or browser/DOM capture produced during apply.
  Reviewer Check: confirm the evidence satisfies AC-3 and no unchecked AC was self-approved by the implementation agent.
- [ ] Task 4: Add tests for bad id, no-match, invalid classroom code, missing context, permission boundary, and global tool priority on error pages.
  Covers: AC-2, AC-3, AC-4, AC-5
  Acceptance: the implementation evidence demonstrates this task outcome without closing unrelated findings.
  Evidence: code/test/report diff or browser/DOM capture produced during apply.
  Reviewer Check: confirm the evidence satisfies AC-2, AC-3, AC-4, AC-5 and no unchecked AC was self-approved by the implementation agent.
- [ ] Task 5: Update audit report with closure ids and residual gaps.
  Covers: AC-5
  Acceptance: the implementation evidence demonstrates this task outcome without closing unrelated findings.
  Evidence: code/test/report diff or browser/DOM capture produced during apply.
  Reviewer Check: confirm the evidence satisfies AC-5 and no unchecked AC was self-approved by the implementation agent.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
