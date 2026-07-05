## Tasks

- [x] Task 1: Generate or repair scoped core textbook section worklist.
  Covers: AC-1
  Acceptance: Worklist targets only core textbook section-level records, excludes reference-only sources, raw retrieval chunks, and search-document rows, and groups rows by textbook, chapter, graph domain, blocker type, and deterministic shard.
  Evidence: `course-content/runtime/resource-governance/core-textbook-section-path-role-workqueue-items.jsonl` and `core-textbook-section-path-role-workqueue-summary.json`.
  Reviewer Check: Confirm chunk-level records are not primary path candidates.

- [x] Task 2: Review section path roles item by item.
  Covers: AC-1, AC-2
  Acceptance: Selected section queue/shard records are assigned path/support/remediation/exclusion roles with rationale.
  Evidence: `course-content/runtime/resource-governance/core-textbook-section-path-role-review-items.jsonl` and `core-textbook-section-path-role-review-evidence.md`.
  Reviewer Check: Confirm graph/LearningGoal mapping is semantically valid.

- [x] Task 3: Validate section/chunk boundary.
  Covers: AC-3
  Acceptance: Chunks and figures in the selected queue/shard cite through parent sections unless separately reviewed, and unselected shards remain in the workqueue or downstream handoff.
  Evidence: `npm run test:core-textbook-section-path-roles`.
  Reviewer Check: Confirm no raw chunk becomes a PathNode.

## Validation

- [x] Run `rtk openspec validate review-core-textbook-section-path-roles --strict`.
- [x] Run the helper or targeted tests named in the task evidence.
- [x] Preserve before/after helper output for independent review.
