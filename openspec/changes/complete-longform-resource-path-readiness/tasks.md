## Tasks

- [ ] 1. Run helper and inventory all in-scope long-form resource gaps.
  - Separate all helper-discovered containers, chapters, sections, chunks, figures, descriptions, transcript segments, slides, media anchors, and exercises.

- [ ] 2. Manually classify long-form dispositions.
  - Mark every in-scope long-form unit as path-plannable, supporting-citation, embedded-asset, evidence-producing, or excluded-with-rationale.

- [ ] 3. Complete reviewed section metadata.
  - Fill graph refs, LearningGoal refs, prerequisite stage, path role, estimated time, citation target, authority, privacy, source hash, and review metadata.

- [ ] 4. Preserve chunk-level citation behavior.
  - Ensure chunks and figures remain citation-ready and deep-linkable without becoming PathNodes unless separately reviewed.

- [ ] 5. Validate planner and Konling behavior.
  - Verify generated paths can include reviewed long-form sections and Konling citations can deep-link to the supporting chunk/section anchor.
  - Preserve before/after helper denominator counts by source family and grain, unaccounted counts, invalid promotion counts, unreviewed semantic counts, and remaining blocker counts.

- [ ] 6. Validate the change.
  - Run `rtk openspec validate complete-longform-resource-path-readiness --strict`.
  - Run helper, RAG/citation checks, and targeted path planning checks.
