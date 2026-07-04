---
change_id: complete-learning-goal-assessment-baselines
claim_branch: complete-learning-goal-assessment-baselines
series: resource-path-readiness
coupling_group: resource-path-readiness-2026-07
execution_mode: stacked
base_branch: integration
required_branch:
depends_on:
  - complete-foundation-graph-resource-bindings
  - complete-analysis-design-graph-resource-bindings
  - complete-simulation-transfer-graph-bindings
parent_issue: 786
blocked_by:
  - complete-foundation-graph-resource-bindings
  - complete-analysis-design-graph-resource-bindings
  - complete-simulation-transfer-graph-bindings
blocking:
  - close-graph-resource-coverage-backlog
  - close-resource-disposition-review-backlog
  - complete-resource-evidence-lineage-readiness
  - wire-adaptive-engine-to-reviewed-item-catalog
openspec_path: openspec/changes/complete-learning-goal-assessment-baselines
risk: high
area: assessment
---

## Goal

Build and review the minimum assessment resource set needed for every current LearningGoal to support readiness, practice, checkpoint, remediation, and terminal-validation stages.

## Scope

- Reuse existing static bank, Prisma Question rows, AC-Q files, iCourse objective items, K/A/Q foundation items, and manually authored checkpoint items before creating new items.
- Manually review every counted item for LearningGoal, K/A/Q objective, graph node, difficulty, cognitive level, misconception, remediation, and source hash.
- Author only the minimum new items needed to close verified gaps.

## Out of Scope

- Do not wire runtime next-question selection; that remains in wire-adaptive-engine-to-reviewed-item-catalog.
- Do not count generated or unreviewed items as baseline coverage.

## Acceptance Checklist

- [ ] AC-1: All 9 LearningGoals have reviewed minimum diagnostic, practice, checkpoint, remediation, and terminal-validation where required item sets or precise gap states. Owner: independent reviewer.
  Evidence: assessment coverage matrix output.
- [ ] AC-2: Terminal-validation assessment requirements are satisfied or explicitly delegated to governed simulation/workbench/Arena evidence. Owner: independent reviewer.
  Evidence: coverage matrix and path policy output.
- [ ] AC-3: Every counted item has current human semantic review and valid source hash. Owner: independent reviewer.
  Evidence: semantic review coverage output.

## Tasks

- [ ] Task 1: Generate LearningGoal assessment worklists.
  Covers: AC-1
  Acceptance: Worklists show missing stages and candidate existing items per LearningGoal.
  Evidence: coverage matrix output.
  Reviewer Check: Confirm all 9 goals are enumerated dynamically.
- [ ] Task 2: Manually review and classify existing items.
  Covers: AC-1, AC-3
  Acceptance: Existing suitable items become reviewed/path-eligible for specific stages.
  Evidence: semantic review output.
  Reviewer Check: Confirm broad or ambiguous items are not counted.
- [ ] Task 3: Author minimal new checkpoint/remediation/terminal-validation where required items where needed.
  Covers: AC-1, AC-2, AC-3
  Acceptance: Only verified gaps receive new reviewed items with full semantics.
  Evidence: source diff and coverage output.
  Reviewer Check: Confirm new items align with graph and capability targets.
- [ ] Task 4: Validate assessment baseline completeness.
  Covers: AC-1, AC-2, AC-3
  Acceptance: OpenSpec and targeted coverage tests pass.
  Evidence: `rtk openspec validate complete-learning-goal-assessment-baselines --strict` plus assessment coverage tests.
  Reviewer Check: Confirm runtime selection is not implemented here.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Preserve before/after helper evidence for this batch.
- Do not auto-promote semantic fields from scripts, SAR, RAG, or model suggestions without human review.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
