## Tasks

- [x] Task 1: Update student-facing portrait consumers.
  Covers: AC-1
  Acceptance: Profile, growth, and evidence review surfaces render seven portrait v2 dimensions or explicit migrated-data limitations.
  Evidence: API/component tests and browser evidence where practical.
  Reviewer Check: Confirm six-card legacy UI is not the primary path.

- [x] Task 2: Update adaptive learner-state, path planner, and Konling consumers.
  Covers: AC-2
  Acceptance: Personalization, weak-dimension selection, and learner-context summaries use portrait v2 ids and metadata.
  Evidence: Focused planner and Konling tests.
  Reviewer Check: Confirm compatibility adapters are not used as primary outputs.

- [x] Task 3: Update recommendations, evidence cache, and class aggregation.
  Covers: AC-3
  Acceptance: Recommendation rationale, `LearningRecommendation` persistence, `StudentEvidenceFeatureCache`, `ClassCompetencySnapshot`, and teacher insights use portrait v2 ids, confidence, freshness, and limitation metadata.
  Evidence: Recommendation, evidence-cache, and teacher insight tests.
  Reviewer Check: Confirm six-dimensional values cannot re-enter learner-state or teacher dashboards as primary portrait data.

- [x] Task 4: Add legacy primary-usage gates.
  Covers: AC-4
  Acceptance: A repository gate fails when new code writes or exposes six-dimensional `CompetencyVector` as primary portrait truth outside explicit compatibility adapters.
  Evidence: Gate tests.
  Reviewer Check: Confirm exemptions are narrow and named.

- [x] Task 5: Update documentation and tests.
  Covers: AC-5
  Acceptance: Project docs and regression tests describe seven portrait v2 as the primary learner portrait and legacy six-dimensional data as compatibility-only.
  Evidence: Documentation diff and focused tests.
  Reviewer Check: Confirm docs do not describe six dimensions as current primary model.

- [x] Task 6: Run validation.
  Covers: AC-6
  Acceptance: OpenSpec validation and issue-body validation pass.
  Evidence: Validation command output.
  Reviewer Check: Confirm all AC ids map to implementation evidence.

## Validation

- [x] Run `rtk openspec validate wire-portrait-v2-consumers-and-gates --strict`.
- [x] Run focused profile, learner-state, planner, Konling, and legacy-gate tests.
- [x] Run focused recommendation, student-evidence-feature-cache, and teacher insight tests.
- [x] Run `rtk npm run test:data-governance` when implementation touches shared data-governance paths.
- [x] Run Buddy issue-body validation before GitHub issue creation.
