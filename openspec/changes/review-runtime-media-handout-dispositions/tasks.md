## Tasks

- [ ] Task 1: Generate media/handout worklist.
  Covers: AC-1
  Acceptance: Worklist groups media and handouts by lesson, kind, and blocker type.
  Evidence: helper workqueue output.
  Reviewer Check: Confirm textbook sections and runtime steps are excluded.

- [ ] Task 2: Review dispositions and anchor requirements.
  Covers: AC-1, AC-2
  Acceptance: Each media/handout record has disposition and citation anchor state.
  Evidence: helper and citation readiness output.
  Reviewer Check: Confirm citation-only media are not promoted as PathNodes.

- [ ] Task 3: Complete path metadata for independent media.
  Covers: AC-3
  Acceptance: Independent media have route, evidence, privacy, and graph metadata.
  Evidence: ResourceNode audit output.
  Reviewer Check: Confirm launch and access policy are valid.

## Validation

- [ ] Run `rtk openspec validate review-runtime-media-handout-dispositions --strict`.
- [ ] Run the helper or targeted tests named in the task evidence.
- [ ] Preserve before/after helper output for independent review.
