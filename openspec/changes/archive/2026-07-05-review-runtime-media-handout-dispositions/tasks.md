## Tasks

- [x] Task 1: Generate or repair scoped media/handout worklist.
  Covers: AC-1
  Acceptance: Worklist groups only runtime media and handouts by lesson, kind, blocker type, and deterministic shard; non-media/handout families are excluded, and identity-repaired handout rows are included.
  Evidence: `course-content/runtime/resource-governance/runtime-media-handout-disposition-workqueue-items.jsonl`, `course-content/runtime/resource-governance/runtime-media-handout-disposition-workqueue-summary.json`.
  Reviewer Check: Confirm textbook sections and runtime steps are excluded.

- [x] Task 2: Review dispositions and anchor requirements.
  Covers: AC-1, AC-2
  Acceptance: Each selected media/handout queue/shard record has disposition and citation anchor state.
  Evidence: `course-content/runtime/resource-governance/runtime-media-handout-disposition-review-items.jsonl`, `course-content/runtime/resource-governance/runtime-media-handout-disposition-review-evidence.md`.
  Reviewer Check: Confirm citation-only media are not promoted as PathNodes.

- [x] Task 3: Complete path metadata for independent media.
  Covers: AC-3
  Acceptance: Independent media in the selected queue/shard have route, evidence, privacy, and graph metadata, and unselected shards remain in the workqueue or downstream handoff.
  Evidence: selected shard `lesson:1-1` reports `independentPathPlannableMedia: 0`, `promotedAsPathNode: 0`, and `unselectedRows: 776` in `course-content/runtime/resource-governance/runtime-media-handout-disposition-workqueue-summary.json`.
  Reviewer Check: Confirm launch and access policy are valid.

## Validation

- [x] Run `rtk openspec validate review-runtime-media-handout-dispositions --strict`.
- [x] Run the helper or targeted tests named in the task evidence.
- [x] Preserve before/after helper output for independent review.
