## Tasks

- [x] Task 1: Generate scoped runtime workqueues.
  Covers: AC-1
  Acceptance: Queues include only runtime lesson step/module/media/slide/audio/video/PDF/handout items and record starting blocker counts.
  Evidence: `course-content/runtime/resource-governance/runtime-lesson-media-resource-semantics-workqueue-items.jsonl`, `runtime-lesson-media-resource-semantics-workqueue-summary.json`; 2,598 audit/projection rows, remaining 0.
  Reviewer Check: Confirm the denominator is stable and excludes long-form/assessment families.

- [x] Task 2: Review independent runtime PlanningUnits.
  Covers: AC-2
  Acceptance: Executable runtime steps and handouts that should appear in paths have reviewed route, graph/K/A/Q, LearningGoal fit, path stage, time cost, evidence contract, privacy, readiness, citation, and review metadata.
  Evidence: Explicit item-level closure review source/items plus `resource-field-completion-audit.jsonl`; 16 runtime steps have existing LearningGoal baseline bindings and satisfy formal launch/evidence/readiness/graph/citation gates. Baseline generation consumes current audit eligibility only: for `simulation-validation-practice`, concept and citation `pathEligible` are exactly 2 (`runtime-step:4-7:step-03` and `runtime-step:4-7:step-04`); steps 05-10 remain supporting-citation with `currentPathEligible=false` and are not restored from historical baseline artifacts.
  Reviewer Check: Confirm each promoted item is independently launchable and student-appropriate.

- [x] Task 3: Review supporting runtime fragments and media.
  Covers: AC-3
  Acceptance: Modules, media assets, slides, transcripts, and fragments without independent path contracts are linked to parent PlanningUnits or classified as supporting/embedded/evidence/excluded with rationale.
  Evidence: `runtime-lesson-media-resource-semantics-review-items.jsonl` records 2,582 non-promoted rows with explicit parent lesson/resource references and per-item rationale; media/handout helper regression and closure regression pass.
  Reviewer Check: Confirm no fragment is promoted only because it has content.

- [x] Task 4: Validate LearningGoal resource mix impact.
  Covers: AC-4
  Acceptance: All-goal diagnostics show runtime resource families are available where reviewed resources exist, and remaining gaps are specific.
  Evidence: `full-resource-path-readiness-gate-summary.json` and focused all-goal diagnostic: 9/9 registered goals have unique diagnostics, missing/unknown/duplicate diagnostic ids are 0; runtime review status is 2,598/2,598 human-confirmed. Global baseline gaps remain explicit.
  Reviewer Check: Confirm diagnostics are not cosmetic counts only.

- [x] Task 5: Run validation.
  Covers: AC-5
  Acceptance: OpenSpec validation, issue-body validation, helper checks, and focused runtime/resource tests pass.
  Evidence: strict OpenSpec and issue-body validators pass; closure/helper regressions pass; focused ResourceNode/resource-field/projection suite passes 86/86; `npm run typecheck` passes. The global path gate remains failed only on explicit downstream LearningGoal baseline/fixture blockers.
  Reviewer Check: Confirm all AC ids have evidence.

## Validation

- [x] Run `rtk openspec validate complete-runtime-lesson-media-resource-semantics --type change --strict`.
- [x] Run helper/resource audit for runtime lesson and media families: `rtk npm run db:complete-runtime-lesson-media-resource-semantics`, `rtk npm run test:runtime-lesson-media-resource-semantics`, and existing runtime helper tests.
- [x] Run focused path diagnostics for all registered LearningGoals: 9/9 diagnostic ids match; missing/unknown/duplicate ids are 0.
- [x] Run issue-body validation before GitHub issue creation: `rtk /Users/YW/Documents/Project/OpenSpec-buddy/skills/openspec-buddy/scripts/validate-issue-body.mjs openspec/changes/complete-runtime-lesson-media-resource-semantics/.buddy/issue.md`.
