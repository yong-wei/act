---
change_id: audit-remediation-teacher-classroom-review-delivery-closure
claim_branch: audit-remediation-teacher-classroom-review-delivery-closure
series: product-design-audit-leftovers
coupling_group: product-design-audit-leftovers
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/audit-remediation-teacher-classroom-review-delivery-closure
risk: high
area: teacher-workflows
---

## Goal

关闭教师课堂、复盘、报告交付、评分和教师侧学生证据链路中仍未闭环的 Product Design 审计问题。

## Scope

- 把教师课堂结束、删除、复盘、报告交付、评分、学生证据处置和课前包入口纳入同一垂直整改。
- 要求每个教师动作显示影响范围、执行状态、失败恢复和审计证据。
- 补齐移动端教师长报告/评分/证据页面的主动作固定区和上下文保留。

## Out of Scope

- Implementing unrelated active SAR/Source Pack/RAG changes.
- Closing audit findings not explicitly covered by validation evidence.
- Replacing existing shared status, ledger, or governance primitives with a parallel system.

## Acceptance Checklist

- [ ] AC-1: 未关闭教师线 finding 被映射到报告账本、评分、证据治理、课堂生命周期和课前包近场动作等具体整改面。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.
- [ ] AC-2: 教师报告、评分、证据、课堂生命周期和课前包动作保留上下文，不再落到泛化或内部端点。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.
- [ ] AC-3: 每个变更后的教师动作通过既有 status/ledger primitives 暴露状态、恢复和审计证据。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.
- [ ] AC-4: 移动教师报告、评分和证据页面保留可达主动作，并有截图或 DOM 宽度证据。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.
- [ ] AC-5: OpenSpec、目标测试和审计报告回写均通过验证。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.

## Tasks

- [ ] Task 1: Inventory the unclosed teacher findings and map each to report ledger, grading, evidence governance, classroom lifecycle, or prep-pack surface.
  Covers: AC-1
  Acceptance: the implementation evidence demonstrates this task outcome without closing unrelated findings.
  Evidence: code/test/report diff or browser/DOM capture produced during apply.
  Reviewer Check: confirm the evidence satisfies AC-1 and no unchecked AC was self-approved by the implementation agent.
- [ ] Task 2: Implement context-preserving report/grading/evidence/prep-pack entry and recovery states using existing contracts.
  Covers: AC-2, AC-3
  Acceptance: the implementation evidence demonstrates this task outcome without closing unrelated findings.
  Evidence: code/test/report diff or browser/DOM capture produced during apply.
  Reviewer Check: confirm the evidence satisfies AC-2, AC-3 and no unchecked AC was self-approved by the implementation agent.
- [ ] Task 3: Add focused tests for report delivery, grading deep links, evidence remediation, classroom end/delete states, and mobile primary actions.
  Covers: AC-2, AC-3, AC-4
  Acceptance: the implementation evidence demonstrates this task outcome without closing unrelated findings.
  Evidence: code/test/report diff or browser/DOM capture produced during apply.
  Reviewer Check: confirm the evidence satisfies AC-2, AC-3, AC-4 and no unchecked AC was self-approved by the implementation agent.
- [ ] Task 4: Update the audit report with closed finding ids and evidence paths after validation.
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
