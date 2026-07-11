---
change_id: stabilize-portrait-incremental-updates
claim_branch: stabilize-portrait-incremental-updates
series: portrait-v2-primary-model
coupling_group: learner-portrait-v2
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - define-portrait-v2-primary-model
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/stabilize-portrait-incremental-updates
risk: high
area: data-governance
---

## Goal

Change learner portrait materialization from recent-window overwrite behavior to stable long-term portrait state with incremental evidence correction.

## Scope

- Implement the portrait v2 incremental update engine.
- Update worker materialization so sparse or missing evidence cannot reset untouched dimensions.
- Separate score, confidence, freshness, evidence recency, and trend.
- Add regression tests for no-new-evidence, sparse path-selection facts, stale evidence, and negative evidence.

## Out of Scope

- Defining the primary portrait v2 contract.
- Migrating existing production rows.
- Updating every UI consumer.
- Changing resource semantic completion.

## Acceptance Checklist

- [ ] AC-1: Portrait updates accept previous portrait state plus evidence delta and return seven-dimensional portrait v2 state. Owner: independent reviewer.
  Evidence: focused portrait update unit tests.
- [ ] AC-2: Dimensions without relevant new evidence preserve their previous score. Owner: independent reviewer.
  Evidence: no-new-evidence and sparse-update regression tests.
- [ ] AC-3: Worker materialization no longer overwrites the whole portrait from a fixed recent LearningFact window. Owner: independent reviewer.
  Evidence: worker tests and implementation diff.
- [ ] AC-4: Stale evidence lowers freshness or confidence rather than erasing score, while negative evidence can reduce score with bounded rationale. Owner: independent reviewer.
  Evidence: aging and negative-evidence tests.
- [ ] AC-5: OpenSpec and Buddy contracts remain valid. Owner: independent reviewer.
  Evidence: `rtk openspec validate stabilize-portrait-incremental-updates --strict` and issue-body validation pass.

## Tasks

- [ ] Task 1: Implement the portrait v2 incremental update engine.
  Covers: AC-1, AC-2
  Acceptance: Engine preserves untouched dimensions and returns seven-dimensional output.
  Evidence: Focused unit tests.
  Reviewer Check: Confirm score, confidence, freshness, evidence, and trend are separate.
- [ ] Task 2: Update student snapshot worker materialization.
  Covers: AC-2, AC-3
  Acceptance: Worker loads prior portrait state and applies deltas instead of fixed-window full overwrite.
  Evidence: Worker regression tests.
  Reviewer Check: Confirm sparse facts cannot reset unrelated dimensions.
- [ ] Task 3: Add stale and negative evidence regression tests.
  Covers: AC-4
  Acceptance: Aging affects freshness/confidence; explicit negative evidence applies bounded decreases with rationale.
  Evidence: Focused test output.
  Reviewer Check: Confirm tests cover both stale and negative paths.
- [ ] Task 4: Run validation and prepare review evidence.
  Covers: AC-5
  Acceptance: OpenSpec validation, issue-body validation, and focused tests pass.
  Evidence: Command output in implementation summary.
  Reviewer Check: Confirm all AC ids have evidence and no AC is self-approved.

## Agent Guardrails

- Only execute this issue's change.
- Do not migrate existing production rows in this issue.
- Do not rewrite unrelated resource or path-planner logic.
- Do not hide zero scores in the UI as a substitute for fixing the update model.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
