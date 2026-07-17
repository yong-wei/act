## Tasks

- [x] Task 1: Generate scoped long-form workqueues.
  Covers: AC-1
  Acceptance: Queues include textbook/reference sections, search documents, chunks, figures, captions, image descriptions, equations, tables, and citation targets with starting blocker counts.
  Evidence: Helper output.
  Reviewer Check: Confirm runtime and assessment items are excluded.

- [x] Task 2: Review section candidates; authorize PlanningUnit only when a full human path contract exists.
  Covers: AC-2
  Acceptance: All 1007 section candidates have concrete review conclusions: 988 have body/formula/table/figure/learning-objective/example-grounded semantic review and 19 are explicitly blocked as insufficient-source; those 19 are review-concluded but are not counted semanticReviewed. Only human-confirmed candidates with book/ref source, section ref, citation target, accepted graph/K/A/Q and LearningGoal fit, prerequisite position, estimated time, path role, authority, privacy, source hash, launch/readiness/evidence contracts, and review metadata may become PlanningUnits. This batch authorizes zero PlanningUnits.
  Evidence: Explicit persistent review source, metadata diff, ResourceNode audit, and longform full/clean/idempotence validation.
  Reviewer Check: Confirm agent-reviewed sections remain teacher-only audit resources and are not treated as student path resources or raw retrieval-derived acceptance.

- [x] Task 3: Review chunk/search-document/figure/caption support roles.
  Covers: AC-3
  Acceptance: Non-section long-form items have exact canonical parent links or explicit canonical hierarchy chains, citation anchors, support/exclusion rationale, and cannot become PathNodes. A figure with only chapter-level source ownership must use its canonical chapter parent and cannot select an arbitrary section in that chapter.
  Evidence: Parent-link checks and helper before/after output.
  Reviewer Check: Confirm search documents are not promoted by retrieval relevance alone.

- [x] Task 4: Validate citation addressability.
  Covers: AC-4
  Acceptance: Selected supporting citations resolve through section, figure, page, or anchor metadata.
  Evidence: Citation resolver/RAG focused checks.
  Reviewer Check: Confirm citations are clickable or limitation-marked.

- [x] Task 5: Run validation.
  Covers: AC-5
  Acceptance: OpenSpec validation, issue-body validation, helper checks, focused RAG/citation tests, and the real staged semantic gate pass.
  Evidence: Strict OpenSpec and Buddy issue-body validators, longform live/full plus delivery/clean-clone and idempotence checks, staged CLI command-contract field negatives, RAG/citation checks, focused Vitest, and typecheck pass. The real `verify:new-resource-semantics -- --staged` gate reports zero issues; all 3082 new audit-only longform projection IDs are checked, while all 3190 pre-existing runtime projection IDs retain byte-identical serialization. The repository-wide full-resource path readiness artifact remains intentionally fail-closed on unrelated global evidence-lineage blockers.
  Reviewer Check: Confirm all AC ids have evidence.

## Validation

- [x] Run `rtk openspec validate complete-longform-textbook-reference-resource-semantics --strict`.
- [x] Run helper/resource audit for long-form families.
- [x] Run targeted citation resolver and RAG checks.
- [x] Run issue-body validation before GitHub issue creation.
