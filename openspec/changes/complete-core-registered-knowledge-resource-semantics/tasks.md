## Tasks

- [ ] Task 1: Generate and freeze the scoped workqueue.
  Covers: AC-1
  Acceptance: Workqueue includes only remaining registered-resource, knowledge-card, and knowledge-infograph items and records starting blocker counts.
  Evidence: Helper output path and summary.
  Reviewer Check: Confirm the queue is scoped and deterministic.

- [ ] Task 2: Review each resource item by item.
  Covers: AC-2
  Acceptance: Each in-scope item has reviewed disposition, graph/K/A/Q mapping or rationale, LearningGoal fit, path profile where applicable, citation route, evidence policy, privacy policy, source/version evidence, and review metadata.
  Evidence: Diff of resource metadata plus before/after helper output.
  Reviewer Check: Confirm semantic fields reflect content meaning, not bulk script guesses.

- [ ] Task 3: Validate path and citation eligibility.
  Covers: AC-3
  Acceptance: Path-plannable items have route, evidence, and readiness metadata; supporting/embedded/excluded items cannot become PathNodes.
  Evidence: ResourceNode audit and focused path/RAG checks.
  Reviewer Check: Confirm promoted items are safe for student path use.

- [ ] Task 4: Close the batch queue.
  Covers: AC-4
  Acceptance: The scoped helper queue has zero unreviewed or unexplained remaining items, except concrete missing-source blockers with evidence.
  Evidence: Before/after helper summary.
  Reviewer Check: Confirm no item was skipped because semantic review was required.

- [ ] Task 5: Run validation.
  Covers: AC-5
  Acceptance: OpenSpec validation, issue-body validation, helper checks, and targeted resource tests pass.
  Evidence: Command output.
  Reviewer Check: Confirm all AC ids have evidence.

## Validation

- [ ] Run `rtk openspec validate complete-core-registered-knowledge-resource-semantics --strict`.
- [ ] Run the data completeness helper and ResourceNode audit for the scoped families.
- [ ] Run issue-body validation before GitHub issue creation.
