---
change_id: audit-remediation-teacher-evidence-intervention-closure
claim_branch: audit-remediation-teacher-evidence-intervention-closure
series: product-design-audit-leftovers-next
coupling_group: product-design-audit-leftovers
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue: 722
blocked_by: []
blocking: []
openspec_path: openspec/changes/audit-remediation-teacher-evidence-intervention-closure
risk: high
area: teacher-evidence
---

## Goal

关闭教师报告、评分、学生证据 deep link、课堂复盘和强化/补练干预仍未形成业务闭环的审计问题。

## Scope

- 把教师报告、评分工作台、学生证据页和班级复盘中的后续建议统一为可执行干预动作。
- 支持反馈发送、评分写回、强化任务、补练路径的持久状态、失败恢复和学生侧可见结果。
- 在学习者状态或路径上下文不足时保留证据引用，并只降低个性化程度。
- 更新审计报告与 evidence 工件。

## Out of Scope

- Rewriting the teacher report architecture from scratch.
- Closing admin, Arena, classroom lifecycle, or authoring findings not explicitly covered by this change.
- Introducing a parallel evidence model outside existing LearningFact, path, task, and evidence governance contracts.

## Acceptance Checklist

- [ ] AC-1: 剩余教师报告、评分、学生证据和干预 finding 已映射到具体页面、API、状态和证据文件。 Owner: independent reviewer.
  Evidence: audit mapping diff, evidence file, and targeted tests.
- [ ] AC-2: 教师可从报告、评分、复盘或学生证据上下文创建反馈、评分写回、强化任务或补练路径，并保留来源上下文。 Owner: independent reviewer.
  Evidence: implementation diff, route/API/component tests, and representative UI/DOM evidence.
- [ ] AC-3: 学习者状态、路径执行或证据映射缺失时，系统仍保留引用和可支持动作，并对不可执行动作给出明确原因。 Owner: independent reviewer.
  Evidence: tests for missing learner-state/path/evidence contexts.
- [ ] AC-4: 成功、待处理、部分成功和失败的教师动作能在学生路径、任务、反馈或证据时间线中正确呈现。 Owner: independent reviewer.
  Evidence: student-side tests and UI/DOM evidence.
- [ ] AC-5: 审计报告只关闭已由本变更验证的 finding，并记录残余范围。 Owner: independent reviewer.
  Evidence: report diff, evidence file, and `openspec validate` output.

## Tasks

- [ ] Task 1: Inventory and map remaining teacher evidence, report, grading, student evidence, and intervention findings.
  Covers: AC-1
  Acceptance: every mapped finding has an owning surface and no unrelated finding is claimed.
  Evidence: audit mapping diff and evidence file.
  Reviewer Check: confirm the mapping is complete for this lane and does not over-close.
- [ ] Task 2: Define or reuse a teacher intervention action contract for feedback, grading writeback, reinforcement task, remedial path, status, and failure reason.
  Covers: AC-2, AC-3
  Acceptance: the contract preserves teacher, student, class/session, source evidence, and supported/blocked status.
  Evidence: code diff and contract tests.
  Reviewer Check: confirm missing-context cases do not break cited evidence or supported actions.
- [ ] Task 3: Implement teacher-side action execution and context-preserving recovery states.
  Covers: AC-2, AC-3
  Acceptance: teacher actions execute or fail with product states from report, grading, review, and evidence entry points.
  Evidence: implementation diff, tests, and representative UI/DOM evidence.
  Reviewer Check: verify no fake success states or context-losing redirects remain in covered paths.
- [ ] Task 4: Persist or explain writeback results and surface successful teacher actions in student views.
  Covers: AC-4
  Acceptance: student path/task/feedback/evidence views reflect accepted teacher actions and pending/blocked states truthfully.
  Evidence: tests and student-side UI/DOM evidence.
  Reviewer Check: confirm student-visible state is backed by persisted data or explicit non-writeback reason.
- [ ] Task 5: Add targeted tests for action contract, missing learner state, path/task writeback success, blocked writeback, context return, and student visibility.
  Covers: AC-2, AC-3, AC-4
  Acceptance: tests fail before implementation or assert the new behavior directly.
  Evidence: test files and command output.
  Reviewer Check: confirm tests cover the required states rather than only snapshots.
- [ ] Task 6: Update audit report and evidence with closure ids and residual gaps.
  Covers: AC-1, AC-5
  Acceptance: report and evidence reference the implemented behavior, validation commands, and remaining open scope.
  Evidence: report diff and evidence file.
  Reviewer Check: confirm each closed finding has evidence and residual gaps are not hidden.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
