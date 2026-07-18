## Tasks

- [x] Task 1: Generate scoped assessment/checkpoint workqueues.
  Covers: AC-1
  Acceptance: Queues include quiz, exercise, homework-derived, adaptive practice, checkpoint, remediation, and terminal-validation candidates with starting blocker counts.
  Evidence: Helper and assessment semantic audit output.
  Reviewer Check: Confirm non-assessment resource families are excluded.

- [x] Task 2: Review each existing assessment item semantically.
  Covers: AC-2
  Acceptance: Every in-scope item has reviewed graph/K/A/Q refs, LearningGoal fit, stage role, difficulty, cognitive level, misconception/remediation mapping, evidence behavior, scoring status, source/version evidence, and review metadata or reviewed limitation.
  Evidence: Metadata diff and semantic audit output.
  Reviewer Check: Confirm mappings reflect item meaning, not script inference.

- [x] Task 3: Fill minimal LearningGoal stage gaps.
  Covers: AC-3
  Acceptance: Every path-ready LearningGoal has reviewed diagnostic, practice, checkpoint, remediation, and required terminal-validation support or a concrete reviewed blocker.
  Evidence: LearningGoal stage coverage matrix.
  Reviewer Check: Confirm new items, if any, are minimal and semantically reviewed.

- [x] Task 4: Validate evidence authority.
  Covers: AC-4
  Acceptance: Items lacking scoring/lineage cannot affect mastery, checkpoint completion, remediation success, or terminal validation.
  Evidence: Data-governance and adaptive assessment tests.
  Reviewer Check: Confirm legacy/unsupported items carry limitations.

- [x] Task 5: Run validation.
  Covers: AC-5
  Acceptance: OpenSpec validation, issue-body validation, helper checks, and focused assessment tests pass.
  Evidence: Command output.
  Reviewer Check: Confirm all AC ids have evidence.

## Validation

- [x] Run `rtk openspec validate complete-assessment-checkpoint-resource-semantics --strict`.
- [x] Run assessment semantic coverage gate and data completeness helper.
- [x] Run focused adaptive assessment/path checkpoint tests.
- [x] Run issue-body validation before GitHub issue creation.
