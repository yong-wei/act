## Tasks

- [ ] Task 1: Generate scoped long-form workqueues.
  Covers: AC-1
  Acceptance: Queues include textbook/reference sections, search documents, chunks, figures, captions, image descriptions, equations, tables, and citation targets with starting blocker counts.
  Evidence: Helper output.
  Reviewer Check: Confirm runtime and assessment items are excluded.

- [ ] Task 2: Review section-level PlanningUnits.
  Covers: AC-2
  Acceptance: Path-plannable sections have reviewed book/ref source, section ref, citation target, graph/K/A/Q fit, LearningGoal fit, prerequisite position, estimated time, path role, authority, privacy, source hash, and review metadata.
  Evidence: Metadata diff and ResourceNode audit.
  Reviewer Check: Confirm sections are student-usable path resources, not raw retrieval rows.

- [ ] Task 3: Review chunk/search-document/figure/caption support roles.
  Covers: AC-3
  Acceptance: Non-section long-form items have parent section links, citation anchors, support/exclusion rationale, and cannot become PathNodes.
  Evidence: Parent-link checks and helper before/after output.
  Reviewer Check: Confirm search documents are not promoted by retrieval relevance alone.

- [ ] Task 4: Validate citation addressability.
  Covers: AC-4
  Acceptance: Selected supporting citations resolve through section, figure, page, or anchor metadata.
  Evidence: Citation resolver/RAG focused checks.
  Reviewer Check: Confirm citations are clickable or limitation-marked.

- [ ] Task 5: Run validation.
  Covers: AC-5
  Acceptance: OpenSpec validation, issue-body validation, helper checks, and focused RAG/citation tests pass.
  Evidence: Command output.
  Reviewer Check: Confirm all AC ids have evidence.

## Validation

- [ ] Run `rtk openspec validate complete-longform-textbook-reference-resource-semantics --strict`.
- [ ] Run helper/resource audit for long-form families.
- [ ] Run targeted citation resolver and RAG checks.
- [ ] Run issue-body validation before GitHub issue creation.
