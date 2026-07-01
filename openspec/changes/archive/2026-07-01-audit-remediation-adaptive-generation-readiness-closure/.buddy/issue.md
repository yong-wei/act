---
change_id: audit-remediation-adaptive-generation-readiness-closure
claim_branch: audit-remediation-adaptive-generation-readiness-closure
series: product-design-audit-leftovers-next
coupling_group: product-design-audit-leftovers
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue: 722
blocked_by: []
blocking: []
openspec_path: openspec/changes/audit-remediation-adaptive-generation-readiness-closure
risk: medium
area: adaptive-learning
---

## Goal

关闭路径生成前置条件和服务错误不可操作的问题，重点覆盖审计报告 finding 335：路径生成入口可见，但缺少班级信息、教师绑定、learner-state 503、advisor 403 或服务不可用时没有解释和下一步。

## Scope

- Define adaptive generation readiness states for class binding, teacher binding, learner-state, advisor-context, service availability, and insufficient evidence.
- Align generation panel and API responses with student-facing recovery actions and staff-facing remediation hints.
- Preserve available evidence and fallback learning suggestions at reduced personalization confidence when personalization services fail.
- Update audit evidence for finding 335 and any directly linked service-error residuals.

## Out of Scope

- Re-closing path-selection, path-execution, evidence-review, latest path, bad pathId, or resource return behavior already covered by `audit-remediation-student-path-evidence-loop-closure`.
- Changing LearningGoal semantics or path planning algorithms.
- Treating service failure as successful path generation.

## Acceptance Checklist

- [ ] AC-1: finding 335 和相关服务错误证据已映射到路径生成 readiness 页面、API 和测试。 Owner: independent reviewer.
  Evidence: audit mapping diff and code references.
- [ ] AC-2: 生成入口区分 ready、missing-class-binding、missing-teacher-binding、learner-state-unavailable、advisor-forbidden、service-unavailable、insufficient-evidence 和 retryable 状态。 Owner: independent reviewer.
  Evidence: contract tests and implementation diff.
- [ ] AC-3: 学生能看到安全的下一步，教师/管理员能看到可排查线索；已可用证据和保底建议不会因个性化服务失败而消失。 Owner: independent reviewer.
  Evidence: UI/DOM evidence and missing-service tests.
- [ ] AC-4: 提案实现不得重复关闭 `audit-remediation-student-path-evidence-loop-closure` 已覆盖的 selection/execution/evidence-review/latest path/resource return finding。 Owner: independent reviewer.
  Evidence: report diff and reviewer comparison against archived change.
- [ ] AC-5: 审计报告只关闭本变更验证的 readiness finding，并记录残余范围。 Owner: independent reviewer.
  Evidence: report diff, evidence file, and `openspec validate` output.

## Tasks

- [ ] Task 1: Map finding 335 and related service-error evidence to generation readiness surfaces.
  Covers: AC-1, AC-4
  Acceptance: mapping names only readiness/service-error residuals and excludes archived path-execution scope.
  Evidence: audit mapping diff and archive comparison.
  Reviewer Check: confirm no already archived path-selection/execution/evidence-review/latest path finding is re-closed.
- [ ] Task 2: Define the adaptive generation readiness contract and recovery actions.
  Covers: AC-2, AC-3
  Acceptance: the contract distinguishes binding, learner-state, advisor, service, evidence, ready, degraded, and retryable states.
  Evidence: design/code diff and contract tests.
  Reviewer Check: confirm student copy is safe while staff diagnostics remain actionable.
- [ ] Task 3: Align generation panel and API responses with readiness states.
  Covers: AC-2, AC-3
  Acceptance: generation UI and API return the same category and no longer collapse blockers into generic retry.
  Evidence: implementation diff, API tests, and UI/DOM evidence.
  Reviewer Check: verify available evidence/fallback suggestions remain visible when personalization is degraded.
- [ ] Task 4: Add targeted readiness tests.
  Covers: AC-2, AC-3
  Acceptance: tests cover learner-state 503, advisor 403, missing binding, retryable failure, insufficient evidence, and ready state.
  Evidence: test files and command output.
  Reviewer Check: confirm tests assert recovery actions, not only error codes.
- [ ] Task 5: Update audit report and evidence with closure ids and residual gaps.
  Covers: AC-1, AC-4, AC-5
  Acceptance: report references readiness evidence and explicitly excludes archived path-execution scope.
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
