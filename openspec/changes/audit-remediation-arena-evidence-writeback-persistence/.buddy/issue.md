---
change_id: audit-remediation-arena-evidence-writeback-persistence
claim_branch: audit-remediation-arena-evidence-writeback-persistence
series: product-design-audit-leftovers-next
coupling_group: product-design-audit-leftovers
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue: 722
blocked_by: []
blocking: []
openspec_path: openspec/changes/audit-remediation-arena-evidence-writeback-persistence
risk: high
area: arena
---

## Goal

把 Arena accepted official submission 的 KAQ evidence writeback 从投影状态升级为幂等持久证据，并让学生、教师、路径规划和控灵消费同一权威结果。

## Scope

- Materialize accepted official Arena writeback outcomes.
- Preserve blocked/degraded outcomes for late, zero, invalid, duplicate-only, unauthorized, or unmapped attempts.
- Align student feedback, teacher publication report, evidence timeline, planner input, and assistant context consumers.
- Update audit evidence and closure mapping.

## Out of Scope

- Changing Arena scoring or leaderboard ranking algorithms.
- Treating invalid attempts as positive mastery evidence.
- Closing classroom lifecycle findings outside Arena evidence writeback.

## Acceptance Checklist

- [ ] AC-1: 剩余 Arena writeback finding 和 projection-only 边界已被映射。 Owner: independent reviewer.
  Evidence: audit mapping diff and code evidence.
- [ ] AC-2: accepted official Arena submission 产生幂等持久 writeback outcome，重复提交不会生成重复学习事实。 Owner: independent reviewer.
  Evidence: persistence/idempotency tests and implementation diff.
- [ ] AC-3: late、zero、invalid、duplicate-only、unauthorized 和 unmapped attempt 不会被提升为正向掌握证据。 Owner: independent reviewer.
  Evidence: negative-path tests.
- [ ] AC-4: 学生反馈、教师报告、证据时间线、路径规划输入和 assistant context 读取同一写回结果。 Owner: independent reviewer.
  Evidence: consumer tests and representative UI/DOM evidence.
- [ ] AC-5: 审计报告只关闭有持久写回证据支撑的 finding，并记录残余范围。 Owner: independent reviewer.
  Evidence: report diff, evidence file, and `openspec validate` output.

## Tasks

- [ ] Task 1: Inventory remaining Arena evidence writeback findings and projection-only boundaries.
  Covers: AC-1
  Acceptance: every claimed finding has an owning writeback or consumer surface.
  Evidence: audit mapping diff and code references.
  Reviewer Check: confirm no leaderboard/scoring-only finding is incorrectly claimed as persistence closure.
- [ ] Task 2: Define persistent Arena KAQ writeback outcome, idempotency key, limitation model, and consumer contract.
  Covers: AC-2, AC-3, AC-4
  Acceptance: the contract distinguishes accepted, degraded, blocked, pending, and duplicate states.
  Evidence: design/code diff and contract tests.
  Reviewer Check: confirm the contract can be consumed by student, teacher, planner, and assistant contexts.
- [ ] Task 3: Implement materialization for accepted official attempts and blocked/degraded outcomes for invalid attempts.
  Covers: AC-2, AC-3
  Acceptance: accepted official attempts persist once and invalid attempts cannot create positive mastery evidence.
  Evidence: implementation diff and persistence tests.
  Reviewer Check: confirm idempotency and negative paths are covered.
- [ ] Task 4: Update consumers to read persisted outcomes.
  Covers: AC-4
  Acceptance: student feedback, teacher report, evidence timeline, planner input, and assistant context do not rely on conflicting UI-only projections.
  Evidence: consumer tests and representative UI/DOM evidence.
  Reviewer Check: confirm all named consumers share the same outcome shape.
- [ ] Task 5: Add targeted tests for persistence, idempotency, invalid attempt blocking, duplicate submission, and consumer consistency.
  Covers: AC-2, AC-3, AC-4
  Acceptance: tests directly assert the new durable behavior.
  Evidence: test files and command output.
  Reviewer Check: confirm tests are not merely snapshot or fixture existence checks.
- [ ] Task 6: Update audit report and evidence with closure ids and residual gaps.
  Covers: AC-1, AC-5
  Acceptance: report and evidence reference the implemented durable writeback behavior.
  Evidence: report diff and evidence file.
  Reviewer Check: confirm closed findings match verified behavior.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
