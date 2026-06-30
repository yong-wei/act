---
change_id: audit-remediation-authoring-api-task-consumption-closure
claim_branch: audit-remediation-authoring-api-task-consumption-closure
series: product-design-audit-leftovers-next
coupling_group: product-design-audit-leftovers
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue: 722
blocked_by: []
blocking: []
openspec_path: openspec/changes/audit-remediation-authoring-api-task-consumption-closure
risk: medium
area: authoring-resources
---

## Goal

关闭作者态 API 有数据但 UI 没有任务化消费的问题，重点覆盖 finding 371：lesson plans、resources、ResourceNodes 和 knowledge nodes 返回数据后仍主要呈现长列表或静态清单，而不是可完成的编辑、治理、引用、保存或回滚任务。

## Scope

- Define task-consumption contracts for authoring APIs: lesson plans, resources, ResourceNodes, and knowledge nodes.
- Turn returned records into available/disabled/pending/saved/failed/rolled-back/not-reversible tasks.
- Add recovery reasons for missing metadata, invalid refs, blocked ResourceNode state, permission, or unsupported rollback.
- Update audit evidence for authoring API-consumption residuals while excluding already archived playlist/graph/builder polish scope.

## Out of Scope

- Re-closing playlist save/play, missing object recovery, graph filter, mobile builder, or button-name findings already covered by `audit-remediation-authoring-knowledge-flow-polish`.
- Rebuilding textbook/RAG export pipelines.
- Changing ResourceNode registry source-of-truth rules.

## Acceptance Checklist

- [ ] AC-1: finding 371 和直接相关作者态 API-consumption 残余已映射到 lesson plan、resource、ResourceNode 和 knowledge-node surfaces。 Owner: independent reviewer.
  Evidence: audit mapping diff and code references.
- [ ] AC-2: API 返回记录被组织为对象合适的任务，而不是仅显示长列表或静态清单。 Owner: independent reviewer.
  Evidence: implementation diff, tests, and UI/DOM evidence.
- [ ] AC-3: 任务状态覆盖 available、disabled with reason、pending、saved、failed、rolled-back 和 not-reversible。 Owner: independent reviewer.
  Evidence: contract/component tests and representative evidence.
- [ ] AC-4: 缺字段、无效引用、blocked ResourceNode、权限或不支持回滚时，UI 解释原因并提供最近恢复动作。 Owner: independent reviewer.
  Evidence: negative-path tests and UI/DOM evidence.
- [ ] AC-5: 审计报告只关闭 API-consumption finding，并明确不重复关闭 `audit-remediation-authoring-knowledge-flow-polish` 已归档范围。 Owner: independent reviewer.
  Evidence: report diff, evidence file, and `openspec validate` output.

## Tasks

- [ ] Task 1: Map finding 371 and direct authoring API-consumption residuals to lesson plan, resource, ResourceNode, and knowledge-node surfaces.
  Covers: AC-1, AC-5
  Acceptance: mapping excludes archived playlist save/play, graph filter, mobile builder, and button-name scope.
  Evidence: audit mapping diff and archive comparison.
  Reviewer Check: confirm only API-consumption residuals are claimed.
- [ ] Task 2: Define authoring API task-consumption contracts and task state taxonomy.
  Covers: AC-2, AC-3, AC-4
  Acceptance: the contract covers task types, state taxonomy, disabled reasons, failure, rollback, and non-reversible explanations.
  Evidence: design/code diff and contract tests.
  Reviewer Check: confirm tasks are object-appropriate and not generic list labels.
- [ ] Task 3: Implement taskized views/actions for covered data.
  Covers: AC-2, AC-3
  Acceptance: covered lesson plan, resource, ResourceNode, and knowledge-node records expose actionable task states.
  Evidence: implementation diff, tests, and UI/DOM evidence.
  Reviewer Check: verify API data is not only rendered as a long static list.
- [ ] Task 4: Add recovery reasons and failure/rollback handling.
  Covers: AC-3, AC-4
  Acceptance: missing metadata, invalid refs, blocked state, permission, and unsupported rollback show specific reasons and nearest recovery.
  Evidence: negative-path tests and UI/DOM evidence.
  Reviewer Check: confirm unsupported rollback is not presented as available.
- [ ] Task 5: Add targeted tests for API-backed task grouping, disabled reasons, persistence, failure recovery, rollback/non-reversible states, and archive-scope exclusion.
  Covers: AC-2, AC-3, AC-4, AC-5
  Acceptance: tests directly assert taskized consumption and exclusion of archived flow scope.
  Evidence: test files and command output.
  Reviewer Check: confirm tests include at least one surface from each covered object type.
- [ ] Task 6: Update audit report and evidence with closure ids and residual gaps.
  Covers: AC-1, AC-5
  Acceptance: report references API-consumption evidence and excludes archived authoring polish scope.
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
