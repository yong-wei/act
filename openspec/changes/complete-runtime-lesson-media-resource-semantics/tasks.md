## Tasks

- [ ] Task 1: Generate scoped runtime workqueues.
  Covers: AC-1
  Acceptance: Queues include only runtime lesson step/module/media/slide/audio/video/PDF/handout items and record starting blocker counts.
  Evidence: Helper workqueue output.
  Reviewer Check: Confirm the denominator is stable and excludes long-form/assessment families.

- [ ] Task 2: Review independent runtime PlanningUnits.
  Covers: AC-2
  Acceptance: Executable runtime steps and handouts that should appear in paths have reviewed route, graph/K/A/Q, LearningGoal fit, path stage, time cost, evidence contract, privacy, readiness, citation, and review metadata.
  Evidence: Metadata diff and ResourceNode audit.
  Reviewer Check: Confirm each promoted item is independently launchable and student-appropriate.

- [ ] Task 3: Review supporting runtime fragments and media.
  Covers: AC-3
  Acceptance: Modules, media assets, slides, transcripts, and fragments without independent path contracts are linked to parent PlanningUnits or classified as supporting/embedded/evidence/excluded with rationale.
  Evidence: Helper before/after output and parent-link checks.
  Reviewer Check: Confirm no fragment is promoted only because it has content.

- [ ] Task 4: Validate LearningGoal resource mix impact.
  Covers: AC-4
  Acceptance: All-goal diagnostics show runtime resource families are available where reviewed resources exist, and remaining gaps are specific.
  Evidence: Planner diagnostic output.
  Reviewer Check: Confirm diagnostics are not cosmetic counts only.

- [ ] Task 5: Run validation.
  Covers: AC-5
  Acceptance: OpenSpec validation, issue-body validation, helper checks, and focused runtime/resource tests pass.
  Evidence: Command output.
  Reviewer Check: Confirm all AC ids have evidence.

## Validation

- [ ] Run `rtk openspec validate complete-runtime-lesson-media-resource-semantics --strict`.
- [ ] Run helper/resource audit for runtime lesson and media families.
- [ ] Run focused path diagnostics for all registered LearningGoals.
- [ ] Run issue-body validation before GitHub issue creation.
