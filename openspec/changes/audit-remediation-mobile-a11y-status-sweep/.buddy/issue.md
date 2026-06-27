---
change_id: audit-remediation-mobile-a11y-status-sweep
claim_branch: audit-remediation-mobile-a11y-status-sweep
series: product-design-audit-leftovers
coupling_group: product-design-audit-leftovers
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - audit-remediation-teacher-classroom-review-delivery-closure
  - audit-remediation-student-path-evidence-loop-closure
  - audit-remediation-admin-governance-operation-states
  - audit-remediation-arena-submission-report-evidence-closure
  - audit-remediation-platform-recovery-deeplink-contracts
  - audit-remediation-authoring-knowledge-flow-polish
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/audit-remediation-mobile-a11y-status-sweep
risk: medium
area: mobile-a11y
---

## Goal

在主要垂直业务状态机补齐后，统一收尾剩余移动布局、focus、dialog、浮层避让和 alert/live 播报问题。

## Scope

- 统一页面级 status/live 验收要求和状态播报查询方式。
- 补齐 dialog/menu/floating panel focus containment、Escape 和 opener focus restoration。
- 对移动长页、宽表和主动作区做最后一轮 320px/390px 审计回归。

## Out of Scope

- Implementing unrelated active SAR/Source Pack/RAG changes.
- Closing audit findings not explicitly covered by validation evidence.
- Replacing existing shared status, ledger, or governance primitives with a parallel system.

## Acceptance Checklist

- [ ] AC-1: 横向收尾前，依赖的垂直整改状态被确认或明确排除，不用壳层补丁替代业务闭环。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.
- [ ] AC-2: 审计移动路由避免文档级横向溢出，并保留主动作可达。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.
- [ ] AC-3: Dialog、menu、AI sidebar 和 floating tools 满足 focus containment、Escape 和 opener focus restoration。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.
- [ ] AC-4: 代表性 action、error、loading、success、failure 状态具备 status/live/alert 证据。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.
- [ ] AC-5: 审计报告只关闭具备业务行为和横向证据双重支撑的 finding。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.

## Tasks

- [ ] Task 1: Wait until dependent vertical remediation changes are implemented or explicitly scoped.
  Covers: AC-1
  Acceptance: the implementation evidence demonstrates this task outcome without closing unrelated findings.
  Evidence: code/test/report diff or browser/DOM capture produced during apply.
  Reviewer Check: confirm the evidence satisfies AC-1 and no unchecked AC was self-approved by the implementation agent.
- [ ] Task 2: Run mobile/a11y inventory for remaining status/live, focus, dialog, floating tool, and overflow findings.
  Covers: AC-1
  Acceptance: the implementation evidence demonstrates this task outcome without closing unrelated findings.
  Evidence: code/test/report diff or browser/DOM capture produced during apply.
  Reviewer Check: confirm the evidence satisfies AC-1 and no unchecked AC was self-approved by the implementation agent.
- [ ] Task 3: Apply shell and primitive fixes only where underlying business behavior is present.
  Covers: AC-2, AC-3, AC-4
  Acceptance: the implementation evidence demonstrates this task outcome without closing unrelated findings.
  Evidence: code/test/report diff or browser/DOM capture produced during apply.
  Reviewer Check: confirm the evidence satisfies AC-2, AC-3, AC-4 and no unchecked AC was self-approved by the implementation agent.
- [ ] Task 4: Capture 320px/390px screenshot or DOM evidence and focus/status checks.
  Covers: AC-2, AC-3, AC-4, AC-5
  Acceptance: the implementation evidence demonstrates this task outcome without closing unrelated findings.
  Evidence: code/test/report diff or browser/DOM capture produced during apply.
  Reviewer Check: confirm the evidence satisfies AC-2, AC-3, AC-4, AC-5 and no unchecked AC was self-approved by the implementation agent.
- [ ] Task 5: Update audit report with closure ids and residual issues.
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
