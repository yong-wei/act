---
change_id: wire-adaptive-engine-to-reviewed-item-catalog
claim_branch: wire-adaptive-engine-to-reviewed-item-catalog
series: adaptive-assessment-item-bank
coupling_group: adaptive-assessment-item-bank
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - unify-adaptive-assessment-item-catalog
  - add-assessment-item-semantic-review-workflow
  - complete-learning-goal-checkpoint-question-sets
parent_issue:
blocked_by:
  - unify-adaptive-assessment-item-catalog
  - add-assessment-item-semantic-review-workflow
  - complete-learning-goal-checkpoint-question-sets
blocking: []
openspec_path: openspec/changes/wire-adaptive-engine-to-reviewed-item-catalog
risk: high
area: assessment
---

## Goal

Switch adaptive next-question selection and path-owned assessment nodes to reviewed, path-eligible catalog items while preserving historical answer snapshots.

## Scope

- Add catalog-backed next-question selection.
- Select by server-owned LearningGoal, path, node, stage, learner state, and asked/answered history.
- Snapshot selected catalog metadata into `AdaptiveAssessmentItemRef`.
- Preserve provisional generated practice only as limited-confidence practice.
- Add coverage for all current path-ready LearningGoals and assessment stages.

## Out of Scope

- Do not create new item content in this change.
- Do not weaken terminal-validation requirements for simulation, workbench, Arena, or project evidence.
- Do not accept client-provided goal/path hints as authorization.

## Acceptance Checklist

- [ ] AC-1: Path-scoped next-question selection uses reviewed, path-eligible catalog candidates filtered by server-owned context. Owner: independent reviewer.
  Evidence: selector implementation and tests.
- [ ] AC-2: Incomplete catalog coverage returns a limitation instead of substituting generated, unreviewed, stale, deprecated, or template items. Owner: independent reviewer.
  Evidence: negative tests.
- [ ] AC-3: `AdaptiveAssessmentItemRef` snapshots catalog item id, content hash, semantic metadata, review state, eligibility state, and version refs. Owner: independent reviewer.
  Evidence: persistence tests.
- [ ] AC-4: Historical pre-catalog answer snapshots remain readable. Owner: independent reviewer.
  Evidence: compatibility tests.
- [ ] AC-5: Provisional generated practice remains low-stakes and cannot unlock readiness, checkpoint, heavy nodes, or terminal validation. Owner: independent reviewer.
  Evidence: planner/evidence tests.
- [ ] AC-6: All current path-ready LearningGoals and required stages are covered by tests. Owner: independent reviewer.
  Evidence: targeted adaptive assessment and path planning tests.
- [ ] AC-7: OpenSpec and targeted runtime validation pass. Owner: independent reviewer.
  Evidence: `rtk openspec validate wire-adaptive-engine-to-reviewed-item-catalog --strict` and targeted test command.

## Tasks

- [ ] Task 1: Implement catalog-backed selection.
  Covers: AC-1, AC-2, AC-6
  Acceptance: Path-scoped selection filters by LearningGoal, path node, stage, review state, eligibility, source freshness, readiness, and asked/answered history.
  Evidence: selector tests.
  Reviewer Check: Confirm server-owned path/session state is authoritative.
- [ ] Task 2: Persist selected catalog snapshots.
  Covers: AC-3, AC-4
  Acceptance: Item refs snapshot catalog metadata and historical pre-catalog refs still restore.
  Evidence: persistence compatibility tests.
  Reviewer Check: Confirm catalog updates cannot mutate prior answers.
- [ ] Task 3: Enforce provisional evidence limits.
  Covers: AC-2, AC-5
  Acceptance: Generated/provisional answers remain low-stakes and cannot satisfy readiness, checkpoint, heavy-node, or terminal-validation gates.
  Evidence: planner and evidence tests.
  Reviewer Check: Confirm no fallback path silently upgrades provisional items.
- [ ] Task 4: Validate the change.
  Covers: AC-6, AC-7
  Acceptance: OpenSpec validation and targeted adaptive assessment/path tests pass.
  Evidence: validation command output.
  Reviewer Check: Confirm evidence comes from the implementation branch and covers all current path-ready goals.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
