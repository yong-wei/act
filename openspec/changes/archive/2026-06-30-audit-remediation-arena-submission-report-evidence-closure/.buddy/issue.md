---
change_id: audit-remediation-arena-submission-report-evidence-closure
claim_branch: audit-remediation-arena-submission-report-evidence-closure
series: product-design-audit-leftovers
coupling_group: product-design-audit-leftovers
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/audit-remediation-arena-submission-report-evidence-closure
risk: medium
area: arena
---

## Goal

关闭 Arena 官方提交、多次提交、逾期/0 分、榜单报告和学生证据回流的剩余审计问题。

## Scope

- 在学生提交和教师报告中明确 official/effective/late/zero/invalid attempt policy。
- 把 Arena 提交结果写入学生证据或明确说明不能回流。
- 补齐移动端官方提交入口和报告交付动作的可达性。

## Out of Scope

- Implementing unrelated active SAR/Source Pack/RAG changes.
- Closing audit findings not explicitly covered by validation evidence.
- Replacing existing shared status, ledger, or governance primitives with a parallel system.

## Acceptance Checklist

- [ ] AC-1: 未关闭 Arena finding 被映射到学生提交、发布报告、榜单、移动入口和证据回流面。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.
- [ ] AC-2: Arena 学生与教师视图解释 official/effective/late/zero/invalid attempt policy，且不依赖内部 id 作为主表达。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.
- [ ] AC-3: Arena 报告、榜单和荣誉使用权威 submission records，不提升无效尝试。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.
- [ ] AC-4: 被接受的 Arena 尝试显示 evidence writeback 状态或明确限制。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.
- [ ] AC-5: 移动 Arena 提交与报告动作保持可达并有验证证据。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.

## Tasks

- [ ] Task 1: Map Arena unclosed findings to student submission, publication report, leaderboard, mobile entry, and evidence writeback surfaces.
  Covers: AC-1
  Acceptance: the implementation evidence demonstrates this task outcome without closing unrelated findings.
  Evidence: code/test/report diff or browser/DOM capture produced during apply.
  Reviewer Check: confirm the evidence satisfies AC-1 and no unchecked AC was self-approved by the implementation agent.
- [ ] Task 2: Implement attempt-policy explanation and official source labels across student and teacher views.
  Covers: AC-2, AC-3
  Acceptance: the implementation evidence demonstrates this task outcome without closing unrelated findings.
  Evidence: code/test/report diff or browser/DOM capture produced during apply.
  Reviewer Check: confirm the evidence satisfies AC-2, AC-3 and no unchecked AC was self-approved by the implementation agent.
- [ ] Task 3: Implement or expose governed Arena evidence writeback status.
  Covers: AC-4
  Acceptance: the implementation evidence demonstrates this task outcome without closing unrelated findings.
  Evidence: code/test/report diff or browser/DOM capture produced during apply.
  Reviewer Check: confirm the evidence satisfies AC-4 and no unchecked AC was self-approved by the implementation agent.
- [ ] Task 4: Implement mobile Arena submission and report action reachability for official submission and publication report states.
  Covers: AC-5
  Acceptance: the implementation evidence demonstrates this task outcome without closing unrelated findings.
  Evidence: code/test/report diff or browser/DOM capture produced during apply.
  Reviewer Check: confirm the evidence satisfies AC-5 and no unchecked AC was self-approved by the implementation agent.
- [ ] Task 5: Add tests for late, zero, invalid, repeated, official, evidence-only, and mobile action-reachability cases.
  Covers: AC-2, AC-3, AC-4, AC-5
  Acceptance: the implementation evidence demonstrates this task outcome without closing unrelated findings.
  Evidence: code/test/report diff or browser/DOM capture produced during apply.
  Reviewer Check: confirm the evidence satisfies AC-2, AC-3, AC-4, AC-5 and no unchecked AC was self-approved by the implementation agent.
- [ ] Task 6: Update audit report with evidence-backed closure ids.
  Covers: AC-1, AC-2, AC-3, AC-4, AC-5
  Acceptance: the implementation evidence demonstrates this task outcome without closing unrelated findings.
  Evidence: code/test/report diff or browser/DOM capture produced during apply.
  Reviewer Check: confirm the evidence satisfies AC-1, AC-2, AC-3, AC-4, AC-5 and no unchecked AC was self-approved by the implementation agent.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
