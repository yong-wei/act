## Tasks

- [x] Task 1: Generate and freeze the scoped workqueue.
  Covers: AC-1
  Acceptance: Workqueue includes only remaining registered-resource, knowledge-card, and knowledge-infograph items and records starting blocker counts.
  Evidence: `course-content/runtime/resource-governance/core-registered-knowledge-resource-semantic-workqueue-items.jsonl`; `core-registered-knowledge-resource-semantic-summary.json` reports 608 scoped resources across registered-resource, knowledge-card, and knowledge-infograph.
  Reviewer Check: Confirm the queue is scoped and deterministic.

- [x] Task 2: Review each resource item by item.
  Covers: AC-2
  Acceptance: Each in-scope item has reviewed disposition, graph/K/A/Q mapping or rationale, LearningGoal fit, path profile where applicable, citation route, evidence policy, privacy policy, source/version evidence, and review metadata.
  Evidence: `course-content/runtime/resource-governance/core-registered-knowledge-resource-semantic-review-source.jsonl`; generated review items are derived from this tracked review source, not from helper-inferred semantic completion.
  Reviewer Check: Confirm semantic fields reflect content meaning, not bulk script guesses.

- [x] Task 3: Validate path and citation eligibility.
  Covers: AC-3
  Acceptance: Path-plannable items have route, evidence, and readiness metadata; supporting/embedded/excluded items cannot become PathNodes.
  Evidence: `rtk npx tsx scripts/tests/test-core-registered-knowledge-resource-semantics.ts` verifies only 2 source-backed, currently path-eligible knowledge cards are path-plannable; registered resources without source hashes are evidence-producing, not PathNodes.
  Reviewer Check: Confirm promoted items are safe for student path use.

- [x] Task 4: Close the batch queue.
  Covers: AC-4
  Acceptance: All 608 scoped formal audit rows are human-confirmed before downstream artifacts are derived, with no review-status blockers; concrete source identity, evidence-contract, readiness, dependency, and non-path limitations remain visible.
  Evidence: `resource-field-completion-audit.jsonl` contains the reviewed formal rows; `core-registered-knowledge-resource-semantic-summary.json` preserves the 606 starting rows with blockers as sidecar before-state and reports `unexplainedRemainingItems: 0`; `core-registered-knowledge-resource-semantic-materialization-manifest.json` pins the legacy audit, stable summary, scope/non-scope invariants, review source, and denominator before any output write.
  Reviewer Check: Confirm no item was skipped because semantic review was required.

- [x] Task 5: Run validation.
  Covers: AC-5
  Acceptance: OpenSpec validation, issue-body validation, helper checks, and targeted resource tests pass.
  Evidence: `rtk openspec validate complete-core-registered-knowledge-resource-semantics --strict`; `rtk /Users/YW/Documents/Project/OpenSpec-buddy/skills/openspec-buddy/scripts/validate-issue-body.mjs openspec/changes/complete-core-registered-knowledge-resource-semantics/.buddy/issue.md`; `rtk npx tsx scripts/tests/test-core-registered-knowledge-resource-semantics.ts`; `rtk npm run typecheck`.
  Reviewer Check: Confirm all AC ids have evidence.

## Validation

- [x] Run `rtk openspec validate complete-core-registered-knowledge-resource-semantics --strict`.
- [x] Run `rtk npm run db:materialize-core-semantic-review` twice with the tracked summary timestamp and confirm the second run produces no diff.
- [x] Run the data completeness helper and ResourceNode audit for the scoped families. The helper generated 608 core review rows and updated the scoped core artifacts; the command still exits non-zero on the existing global full-resource-path readiness gate, so scoped acceptance is covered by `scripts/tests/test-core-registered-knowledge-resource-semantics.ts`.
- [x] Run issue-body validation against the existing local issue artifact: `rtk /Users/YW/Documents/Project/OpenSpec-buddy/skills/openspec-buddy/scripts/validate-issue-body.mjs openspec/changes/complete-core-registered-knowledge-resource-semantics/.buddy/issue.md`.
