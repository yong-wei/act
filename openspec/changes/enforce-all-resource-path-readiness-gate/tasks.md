## Tasks

- [ ] 1. Add full-resource readiness gate.
  - Consume helper JSON and fail on missing disposition, invalid promotion, missing reviewed semantics, unexplained exclusion, or unresolved path blocker.
  - Require helper summarized evidence: resource family totals, unaccounted count, invalid promotion count, unreviewed semantic count, evidence-lineage blockers, follow-up buckets, and Yang Fan fixture blockers.

- [ ] 2. Add all-LearningGoal path generation diagnostics.
  - Read the backend goal registry dynamically and test every registered goal.
  - Fail when a path relies on hard-coded goal names, a single-resource fallback where governed alternatives exist, or unreviewed resources.

- [ ] 3. Add resource diversity and citation checks.
  - Verify generated paths can include multiple governed resource families where available.
  - Verify citations for selected/supporting resources resolve through server-owned citation metadata.

- [ ] 4. Integrate with future resource imports.
  - Ensure new TeachingResources, runtime lessons, knowledge cards, infographs, simulations, control workbench entries, Arena resources, quizzes, exercises, textbooks, references, figures, transcripts, slides, media anchors, and image descriptions appear in the helper until classified and reviewed.

- [ ] 5. Validate the change.
  - Run `rtk openspec validate enforce-all-resource-path-readiness-gate --strict`.
  - Run helper, full-resource gate, all-LearningGoal path diagnostics, and targeted citation tests.
