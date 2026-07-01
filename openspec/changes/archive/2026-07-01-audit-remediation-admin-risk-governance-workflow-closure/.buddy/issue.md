---
change_id: audit-remediation-admin-risk-governance-workflow-closure
claim_branch: audit-remediation-admin-risk-governance-workflow-closure
series: product-design-audit-leftovers-next
coupling_group: product-design-audit-leftovers
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue: 722
blocked_by: []
blocking: []
openspec_path: openspec/changes/audit-remediation-admin-risk-governance-workflow-closure
risk: medium
area: admin-governance
---

## Goal

关闭管理员治理风险仍是只读看板的问题，重点覆盖风险行证据、分派、处置、撤销/重开、审计记录和 URL intent 恢复。

## Scope

- Turn governance risk rows into actionable objects with evidence, assignment, disposition, undo/reopen, and audit trail.
- Make `tab=risks&action=resolve/assign` and risk-id intents open action context or product recovery states.
- Persist and announce risk governance action outcomes.
- Update audit evidence for risk-governance findings while excluding already archived import/config/export/no-match/mobile-table scope.

## Out of Scope

- Re-closing user import, failed-row download, filtered export, system config/model tests, no-match, or mobile table findings already covered by `audit-remediation-admin-governance-operation-states`.
- Rebuilding the admin dashboard information architecture.
- Treating a filtered risk table as completed risk disposition.

## Acceptance Checklist

- [ ] AC-1: open risk-governance findings are mapped to risk row, evidence, assignment, disposition, undo/reopen, audit, and URL intent surfaces. Owner: independent reviewer.
  Evidence: audit mapping diff and code references.
- [ ] AC-2: risk rows expose safe identity, affected object, evidence action, assignment state, disposition actions, and audit trail access. Owner: independent reviewer.
  Evidence: implementation diff, tests, and UI/DOM evidence.
- [ ] AC-3: assign, resolve, ignore, reopen, or undo actions persist result state, status/recovery, and audit trail entries. Owner: independent reviewer.
  Evidence: API tests, ledger/audit tests, and representative output.
- [ ] AC-4: governance URL intents open the target action context or distinguish missing, unauthorized, already handled, and unavailable states. Owner: independent reviewer.
  Evidence: route/UI tests and recovery evidence.
- [ ] AC-5: 审计报告只关闭风险治理对象化 finding，并明确不重复关闭 `audit-remediation-admin-governance-operation-states` 已归档范围。 Owner: independent reviewer.
  Evidence: report diff, evidence file, and `openspec validate` output.

## Tasks

- [ ] Task 1: Map open risk-governance findings to risk row, evidence, assignment, disposition, undo, audit, and URL intent surfaces.
  Covers: AC-1, AC-5
  Acceptance: mapping excludes archived import, config, export, no-match, and mobile-table scope.
  Evidence: audit mapping diff and archive comparison.
  Reviewer Check: confirm only risk-governance residuals are claimed.
- [ ] Task 2: Define the risk governance action contract and recovery categories.
  Covers: AC-2, AC-3, AC-4
  Acceptance: the contract covers safe identity, evidence, assignment, disposition, undo/reopen, audit, and recovery.
  Evidence: design/code diff and contract tests.
  Reviewer Check: confirm filtered lists are not treated as disposition completion.
- [ ] Task 3: Implement row-level evidence, assign, resolve, undo/reopen, and audit-trail states.
  Covers: AC-2, AC-3
  Acceptance: risk actions persist and display truthful status and recovery.
  Evidence: implementation diff, API tests, and UI/DOM evidence.
  Reviewer Check: verify actions do not report success without persisted audit state.
- [ ] Task 4: Align URL intents and recovery states.
  Covers: AC-4
  Acceptance: action URLs open context or distinguish missing, unauthorized, already handled, and unavailable states.
  Evidence: route/UI tests and recovery evidence.
  Reviewer Check: confirm no covered intent remains stuck in loading or inert list mode.
- [ ] Task 5: Add targeted tests for evidence deep link, assignment, resolution, undo, audit trail, loading recovery, and URL intent.
  Covers: AC-2, AC-3, AC-4
  Acceptance: tests directly assert risk-governance action behavior.
  Evidence: test files and command output.
  Reviewer Check: confirm tests cover failure and recovery branches.
- [ ] Task 6: Update audit report and evidence with closure ids and residual gaps.
  Covers: AC-1, AC-5
  Acceptance: report references risk-governance evidence and excludes archived operation-state scope.
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
