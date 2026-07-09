## Tasks

- [ ] Task 1: Define the primary portrait v2 learner-state contract.
  Covers: AC-1
  Acceptance: The contract exposes exactly the seven portrait v2 dimensions with score, confidence, freshness, evidence counts, lineage, and calculation version.
  Evidence: Unit tests for contract shape and dimension ids.
  Reviewer Check: Confirm no new primary contract still depends on the six-dimensional `CompetencyVector` shape.

- [ ] Task 2: Add primary portrait v2 persistence/write contract.
  Covers: AC-2
  Acceptance: New learner portrait writes can store and retrieve the seven-dimensional payload with source lineage and version metadata.
  Evidence: Persistence or adapter tests.
  Reviewer Check: Confirm the storage choice preserves auditability and can support migration.

- [ ] Task 3: Mark legacy six-dimensional vectors as compatibility-only.
  Covers: AC-3
  Acceptance: Legacy vectors remain readable for migration and compatibility mapping, but new primary portrait writes do not use them as authoritative output.
  Evidence: Contract tests and code references in implementation summary.
  Reviewer Check: Confirm the implementation does not silently create new six-dimensional primary snapshots.

- [ ] Task 4: Add privacy-scoped source lineage rules.
  Covers: AC-4
  Acceptance: Learner-facing and AI-facing portrait payloads expose only scoped, redacted lineage while reviewer/admin audit paths can access authorized details.
  Evidence: Contract tests for student, Konling/planner, and reviewer/admin lineage payloads.
  Reviewer Check: Confirm raw payloads, private fixture refs, teacher-scoped refs, and migration snapshot ids do not leak to ordinary learners.

- [ ] Task 5: Run validation.
  Covers: AC-5
  Acceptance: OpenSpec validation and issue-body validation pass.
  Evidence: Validation command output.
  Reviewer Check: Confirm all AC ids map to evidence and no checklist item is self-approved.

## Validation

- [ ] Run `rtk openspec validate define-portrait-v2-primary-model --strict`.
- [ ] Run the focused portrait model contract tests added by the implementation.
- [ ] Run Buddy issue-body validation before GitHub issue creation.
