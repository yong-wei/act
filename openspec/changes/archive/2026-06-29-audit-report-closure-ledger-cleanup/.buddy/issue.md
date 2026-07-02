---
change_id: audit-report-closure-ledger-cleanup
claim_branch: audit-report-closure-ledger-cleanup
series: product-design-audit-leftovers
coupling_group: product-design-audit-leftovers
execution_mode: docs-only
base_branch: integration
required_branch:
depends_on: []
parent_issue: 722
blocked_by: []
blocking: []
openspec_path: openspec/changes/audit-report-closure-ledger-cleanup
risk: low
area: audit
---

## Goal

把已经由可信归档变更覆盖、但仍留在未关闭列表中的审计项重新标记，避免后续整改重复处理已关闭问题。

## Scope

- 复核审计报告关闭台账与归档 evidence 的映射。
- 将已由归档变更覆盖的 P0 课前包 finding 从未关闭集合移出，并记录证据路径。
- 补充报告维护规则，要求后续整改区分“实现未闭环”和“关闭映射漏标”。

## Out of Scope

- Implementing unrelated active SAR/Source Pack/RAG changes.
- Closing audit findings not explicitly covered by validation evidence.
- Replacing existing shared status, ledger, or governance primitives with a parallel system.

## Acceptance Checklist

- [ ] AC-1: 归档 P0 stability 证据与 finding 132/133 的映射关系被明确核对并记录。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.
- [ ] AC-2: 审计报告不再把已归档覆盖的 P0 课前包阻断列为 unmarked finding。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.
- [ ] AC-3: 报告引用归档 P0 evidence 路径，并保留 mapping cleanup 与新整改工作的区别。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.
- [ ] AC-4: OpenSpec 与 Buddy issue 校验通过。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.

## Tasks

- [ ] Task 1: Compare report ledger counts with archived P0 stability coverage for finding 132/133.
  Covers: AC-1
  Acceptance: the implementation evidence demonstrates this task outcome without closing unrelated findings.
  Evidence: code/test/report diff or browser/DOM capture produced during apply.
  Reviewer Check: confirm the evidence satisfies AC-1 and no unchecked AC was self-approved by the implementation agent.
- [ ] Task 2: Update the audit report closed/unmarked/partial lists and explanatory notes.
  Covers: AC-2, AC-3
  Acceptance: the implementation evidence demonstrates this task outcome without closing unrelated findings.
  Evidence: code/test/report diff or browser/DOM capture produced during apply.
  Reviewer Check: confirm the evidence satisfies AC-2, AC-3 and no unchecked AC was self-approved by the implementation agent.
- [ ] Task 3: Run markdown diff review and `openspec validate audit-report-closure-ledger-cleanup --strict`.
  Covers: AC-4
  Acceptance: the implementation evidence demonstrates this task outcome without closing unrelated findings.
  Evidence: code/test/report diff or browser/DOM capture produced during apply.
  Reviewer Check: confirm the evidence satisfies AC-4 and no unchecked AC was self-approved by the implementation agent.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
