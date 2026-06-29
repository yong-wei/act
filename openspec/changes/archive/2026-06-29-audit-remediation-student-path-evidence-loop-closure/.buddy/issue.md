---
change_id: audit-remediation-student-path-evidence-loop-closure
claim_branch: audit-remediation-student-path-evidence-loop-closure
series: product-design-audit-leftovers
coupling_group: product-design-audit-leftovers
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/audit-remediation-student-path-evidence-loop-closure
risk: high
area: student-learning
---

## Goal

关闭学生证据、补练、任务、作品集、成长中心和自适应学习路径之间仍断裂的审计问题。

## Scope

- 把学生证据、补练、任务、成长、作品集和路径执行作为一个闭环整改。
- 要求 path-selection/path-execution/evidence-review 等 intent 在无活动路径或缺上下文时显示学生可理解的恢复状态。
- 补齐完成、回顾、继续、写回、收录和路径偏离状态。

## Out of Scope

- Implementing unrelated active SAR/Source Pack/RAG changes.
- Closing audit findings not explicitly covered by validation evidence.
- Replacing existing shared status, ledger, or governance primitives with a parallel system.

## Acceptance Checklist

- [ ] AC-1: 未关闭学生线 finding 被映射到路径 intent、证据来源、任务写回、作品集状态和移动动作。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.
- [ ] AC-2: 学生路径页面在真实路径为空或无效时不再展示伪进度或伪可执行路线。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.
- [ ] AC-3: 学生完成、证据、任务、成长和作品集流程能够写入 governed evidence 或显示明确限制与下一步。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.
- [ ] AC-4: assignment/source/path 上下文在证据、任务、成长和作品集跨页面导航中被保留。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.
- [ ] AC-5: 验证证据覆盖桌面与移动核心状态，并回写审计报告。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.

## Tasks

- [ ] Task 1: Map unclosed student findings to path intent, evidence source, task writeback, portfolio state, and mobile action groups.
  Covers: AC-1
  Acceptance: the implementation evidence demonstrates this task outcome without closing unrelated findings.
  Evidence: code/test/report diff or browser/DOM capture produced during apply.
  Reviewer Check: confirm the evidence satisfies AC-1 and no unchecked AC was self-approved by the implementation agent.
- [ ] Task 2: Implement truthful path/evidence recovery states and context-preserving launches.
  Covers: AC-2, AC-4
  Acceptance: the implementation evidence demonstrates this task outcome without closing unrelated findings.
  Evidence: code/test/report diff or browser/DOM capture produced during apply.
  Reviewer Check: confirm the evidence satisfies AC-2, AC-4 and no unchecked AC was self-approved by the implementation agent.
- [ ] Task 3: Implement completion/writeback/portfolio collection state or explicit limitation states.
  Covers: AC-3, AC-4
  Acceptance: the implementation evidence demonstrates this task outcome without closing unrelated findings.
  Evidence: code/test/report diff or browser/DOM capture produced during apply.
  Reviewer Check: confirm the evidence satisfies AC-3, AC-4 and no unchecked AC was self-approved by the implementation agent.
- [ ] Task 4: Add tests for path:null, bad pathId, evidence-review, task completion, portfolio collection, and student-safe language.
  Covers: AC-2, AC-3, AC-4, AC-5
  Acceptance: the implementation evidence demonstrates this task outcome without closing unrelated findings.
  Evidence: code/test/report diff or browser/DOM capture produced during apply.
  Reviewer Check: confirm the evidence satisfies AC-2, AC-3, AC-4, AC-5 and no unchecked AC was self-approved by the implementation agent.
- [ ] Task 5: Update audit report with evidence-backed closure ids.
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
