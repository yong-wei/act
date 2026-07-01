---
change_id: audit-remediation-classroom-lifecycle-dialog-closure
claim_branch: audit-remediation-classroom-lifecycle-dialog-closure
series: product-design-audit-leftovers-next
coupling_group: product-design-audit-leftovers
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue: 722
blocked_by: []
blocking: []
openspec_path: openspec/changes/audit-remediation-classroom-lifecycle-dialog-closure
risk: medium
area: classroom-lifecycle
---

## Goal

关闭课堂创建、复用、加入、投影、结束、删除、复盘入口和 native dialog 相关的剩余生命周期审计问题。

## Scope

- Unify class-bound, temporary, demo, and real session lifecycle states.
- Replace covered classroom native confirm/alert flows with product dialogs, status, and recovery states.
- Align classroom code errors, active-session reuse/new choices, end/delete impact, projection recovery, ended direct access, and review entry behavior.
- Update audit evidence and closure mapping.

## Out of Scope

- Rewriting all interactive lesson runtimes.
- Changing course content behavior unrelated to lifecycle state.
- Closing teacher report, Arena persistence, admin governance, or authoring findings.

## Acceptance Checklist

- [ ] AC-1: 剩余课堂 lifecycle/native dialog/join/projection/finalization finding 已映射到具体页面、runtime、API 和状态。 Owner: independent reviewer.
  Evidence: audit mapping diff and code references.
- [ ] AC-2: 已覆盖的建课、复用、新开、加入、结束、删除和投影恢复动作使用产品状态，不依赖 native confirm/alert。 Owner: independent reviewer.
  Evidence: implementation diff, dialog/focus tests, and UI/DOM evidence.
- [ ] AC-3: classroom code、active conflict、ended direct link、demo/real runtime 和 review entry 使用一致恢复语义。 Owner: independent reviewer.
  Evidence: API/UI tests and representative runtime evidence.
- [ ] AC-4: 结束或删除课堂展示影响预览、执行状态、学生结束态和教师恢复路径。 Owner: independent reviewer.
  Evidence: lifecycle tests and UI/DOM evidence.
- [ ] AC-5: 审计报告只关闭已由本变更验证的 finding，并记录残余范围。 Owner: independent reviewer.
  Evidence: report diff, evidence file, and `openspec validate` output.

## Tasks

- [ ] Task 1: Inventory remaining classroom lifecycle, native dialog, join, projection, demo/runtime sync, and finalization findings.
  Covers: AC-1
  Acceptance: every claimed finding has an owning classroom surface or API.
  Evidence: audit mapping diff and code references.
  Reviewer Check: confirm non-classroom findings are not claimed.
- [ ] Task 2: Define or reuse classroom lifecycle state and confirmation contracts.
  Covers: AC-2, AC-3, AC-4
  Acceptance: the contract covers launch context, conflict choice, join taxonomy, finalization, destructive actions, and recovery.
  Evidence: design/code diff and contract tests.
  Reviewer Check: confirm native dialog replacement is product-owned and testable.
- [ ] Task 3: Replace covered native confirm/alert paths with product dialogs, status, and recovery states.
  Covers: AC-2, AC-4
  Acceptance: covered destructive or conflict actions have accessible confirmation and truthful result states.
  Evidence: implementation diff, focus tests, and UI/DOM evidence.
  Reviewer Check: verify no covered lifecycle branch still depends on native confirm/alert.
- [ ] Task 4: Align class-bound, temporary, demo, real session, join, projection, end, delete, and review entry states.
  Covers: AC-3, AC-4
  Acceptance: direct links and state transitions render correct live/ended/unavailable/recovery states.
  Evidence: route/API tests and representative UI/DOM evidence.
  Reviewer Check: confirm ended sessions are not rendered as live classes in covered paths.
- [ ] Task 5: Add tests for active conflict, invalid join, ending/deleting, ended direct access, projection recovery, focus, and status announcements.
  Covers: AC-2, AC-3, AC-4
  Acceptance: tests directly assert lifecycle transitions and recovery states.
  Evidence: test files and command output.
  Reviewer Check: confirm tests cover both success and failure branches.
- [ ] Task 6: Update audit report and evidence with closure ids and residual gaps.
  Covers: AC-1, AC-5
  Acceptance: report and evidence reference implemented behavior and remaining open scope.
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
