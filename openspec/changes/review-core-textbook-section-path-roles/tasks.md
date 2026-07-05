## Tasks

- [ ] Task 1: Generate or repair scoped core textbook section worklist.
  Covers: AC-1
  Acceptance: Worklist targets only core textbook section-level records, excludes reference-only sources, raw retrieval chunks, and search-document rows, and groups rows by textbook, chapter, graph domain, blocker type, and deterministic shard.
  Evidence: helper workqueue output.
  Reviewer Check: Confirm chunk-level records are not primary path candidates.

- [ ] Task 2: Review section path roles item by item.
  Covers: AC-1, AC-2
  Acceptance: Selected section queue/shard records are assigned path/support/remediation/exclusion roles with rationale.
  Evidence: source diff and helper output.
  Reviewer Check: Confirm graph/LearningGoal mapping is semantically valid.

- [ ] Task 3: Validate section/chunk boundary.
  Covers: AC-3
  Acceptance: Chunks and figures in the selected queue/shard cite through parent sections unless separately reviewed, and unselected shards remain in the workqueue or downstream handoff.
  Evidence: helper and RAG output.
  Reviewer Check: Confirm no raw chunk becomes a PathNode.

## Validation

- [ ] Run `rtk openspec validate review-core-textbook-section-path-roles --strict`.
- [ ] Run the helper or targeted tests named in the task evidence.
- [ ] Preserve before/after helper output for independent review.
