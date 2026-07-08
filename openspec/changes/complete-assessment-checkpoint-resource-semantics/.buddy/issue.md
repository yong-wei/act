---
change_id: complete-assessment-checkpoint-resource-semantics
claim_branch: complete-assessment-checkpoint-resource-semantics
series: resource-semantic-completion-closure
coupling_group: resource-semantic-data
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue: 876
blocked_by: []
blocking: []
openspec_path: openspec/changes/complete-assessment-checkpoint-resource-semantics
risk: high
area: adaptive-assessment
---

## Goal

Complete reviewed semantics and LearningGoal stage coverage for assessment, quiz, exercise, homework-derived, adaptive practice, checkpoint, remediation, and terminal-validation resources.

## Scope

- Process assessment/checkpoint resource workqueues.
- Review every in-scope item against item meaning, graph nodes, LearningGoal K/A/Q objectives, difficulty, cognitive level, misconception/remediation mapping, evidence behavior, scoring status, source/version state, and review rationale.
- Ensure every path-ready LearningGoal has reviewed diagnostic, practice, checkpoint, remediation, and required terminal-validation support or a concrete blocker.
- Preserve evidence authority boundaries for unsupported legacy items.

## Out of Scope

- Runtime lesson/media and long-form textbook/reference resource review.
- Building a large speculative question bank beyond minimal stage gaps.
- Bulk script-generated semantic completion.

## Acceptance Checklist

- [ ] AC-1: Scoped assessment/checkpoint workqueues are deterministic and include only assessment-related families with starting blocker counts. Owner: independent reviewer.
  Evidence: helper and semantic audit output.
- [ ] AC-2: Every in-scope existing item has reviewed semantic fields or reviewed limitation. Owner: independent reviewer.
  Evidence: metadata diff and semantic audit output.
- [ ] AC-3: Every path-ready LearningGoal has reviewed diagnostic, practice, checkpoint, remediation, and required terminal-validation support or a concrete blocker. Owner: independent reviewer.
  Evidence: LearningGoal stage coverage matrix.
- [ ] AC-4: Items lacking scoring or lineage cannot affect mastery, checkpoint completion, remediation success, or terminal validation. Owner: independent reviewer.
  Evidence: data-governance and adaptive assessment tests.
- [ ] AC-5: OpenSpec and Buddy contracts remain valid. Owner: independent reviewer.
  Evidence: `rtk openspec validate complete-assessment-checkpoint-resource-semantics --strict` and issue-body validation pass.

## Tasks

- [ ] Task 1: Generate scoped assessment/checkpoint workqueues.
  Covers: AC-1
  Acceptance: Queues cover assessment-related families and record starting blockers.
  Evidence: Helper and assessment semantic audit output.
  Reviewer Check: Confirm non-assessment families are excluded.
- [ ] Task 2: Review each existing assessment item semantically.
  Covers: AC-2
  Acceptance: Items have reviewed graph/K/A/Q, LearningGoal, stage, difficulty, cognitive, misconception/remediation, evidence, scoring, source/version, and review metadata or limitation.
  Evidence: Metadata diff and semantic audit output.
  Reviewer Check: Confirm mappings reflect item meaning.
- [ ] Task 3: Fill minimal LearningGoal stage gaps.
  Covers: AC-3
  Acceptance: Each path-ready LearningGoal has required reviewed stage resources or concrete blocker.
  Evidence: LearningGoal stage coverage matrix.
  Reviewer Check: Confirm new items, if any, are minimal and reviewed.
- [ ] Task 4: Validate evidence authority.
  Covers: AC-4
  Acceptance: Unsupported items cannot affect mastery, checkpoint, remediation, or terminal validation.
  Evidence: Data-governance and adaptive assessment tests.
  Reviewer Check: Confirm limitations are explicit.
- [ ] Task 5: Run validation and prepare review evidence.
  Covers: AC-5
  Acceptance: OpenSpec validation, issue-body validation, helper checks, and focused tests pass.
  Evidence: Command output.
  Reviewer Check: Confirm all AC ids have evidence and no AC is self-approved.

## Agent Guardrails

- Only execute this issue's change.
- Semantic review is an implementing-agent responsibility in this issue; do not mark `needs-human` merely because semantic judgment is required.
- Use helper scripts only for workqueue selection, gap measurement, coverage matrices, and validation. Do not use scripts to infer accepted semantic labels.
- New items are allowed only when a LearningGoal stage has no suitable existing item; every new item must be reviewed in this issue.
- Stop only for concrete blockers: missing scoped workqueue, unstable denominator, inaccessible source artifact, schema conflict, dependency conflict, claim conflict, or PR/branch conflict.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
