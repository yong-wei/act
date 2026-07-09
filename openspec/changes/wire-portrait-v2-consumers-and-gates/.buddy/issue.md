---
change_id: wire-portrait-v2-consumers-and-gates
claim_branch: wire-portrait-v2-consumers-and-gates
series: portrait-v2-primary-model
coupling_group: learner-portrait-v2
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - define-portrait-v2-primary-model
  - stabilize-portrait-incremental-updates
  - migrate-legacy-competency-portrait-data
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/wire-portrait-v2-consumers-and-gates
risk: high
area: data-governance
---

## Goal

Wire student-facing, planner-facing, and Konling-facing consumers to portrait v2 and add gates that prevent new primary usage of the legacy six-dimensional model.

## Scope

- Update profile, growth, evidence review, learner-state, path planner, Konling, recommendations, evidence cache, and class-level consumers to use portrait v2.
- Add compatibility adapters only for legacy or migrated data.
- Add gates against new six-dimensional primary writes or student-facing contracts.
- Update tests and documentation to make seven portrait v2 dimensions the expected primary model.

## Out of Scope

- Defining portrait v2 primary model.
- Implementing incremental update engine.
- Running production migration.
- Completing unrelated resource semantics.

## Acceptance Checklist

- [ ] AC-1: Student-facing profile, growth, and evidence surfaces render seven portrait v2 dimensions or explicit migrated-data limitations. Owner: independent reviewer.
  Evidence: API/component tests and browser evidence where practical.
- [ ] AC-2: Adaptive learner-state, path planning, and Konling use portrait v2 for weak dimensions, personalization, and learner-context summaries. Owner: independent reviewer.
  Evidence: focused learner-state, planner, and Konling tests.
- [ ] AC-3: Recommendation generation, `LearningRecommendation` persistence, `StudentEvidenceFeatureCache`, class aggregation, and teacher insights use portrait v2 ids, confidence, freshness, and limitations. Owner: independent reviewer.
  Evidence: recommendation, evidence-cache, and teacher insight tests.
- [ ] AC-4: Repository gates fail on new six-dimensional primary portrait writes or exposed contracts outside approved compatibility adapters. Owner: independent reviewer.
  Evidence: gate tests.
- [ ] AC-5: Documentation and regression tests describe seven portrait v2 as the primary learner portrait and legacy six-dimensional data as compatibility-only. Owner: independent reviewer.
  Evidence: documentation diff and focused test output.
- [ ] AC-6: OpenSpec and Buddy contracts remain valid. Owner: independent reviewer.
  Evidence: `rtk openspec validate wire-portrait-v2-consumers-and-gates --strict` and issue-body validation pass.

## Tasks

- [ ] Task 1: Update student-facing portrait consumers.
  Covers: AC-1
  Acceptance: Student profile/growth/evidence surfaces use seven portrait v2 dimensions.
  Evidence: API/component tests and browser evidence where practical.
  Reviewer Check: Confirm six-card legacy UI is not the primary path.
- [ ] Task 2: Update learner-state, planner, and Konling consumers.
  Covers: AC-2
  Acceptance: Personalization, weak-dimension selection, and learner summaries use portrait v2 ids and labels.
  Evidence: Focused tests.
  Reviewer Check: Confirm compatibility adapters are not treated as native portrait evidence.
- [ ] Task 3: Update recommendations, evidence cache, and class aggregation.
  Covers: AC-3
  Acceptance: Recommendation rationale, `LearningRecommendation` rows, `StudentEvidenceFeatureCache`, `ClassCompetencySnapshot`, and teacher insights use portrait v2 ids and limitation metadata.
  Evidence: Recommendation, evidence-cache, and teacher insight tests.
  Reviewer Check: Confirm six-dimensional values cannot re-enter learner-state, recommendations, or teacher dashboards as primary portrait data.
- [ ] Task 4: Add legacy primary-usage gates.
  Covers: AC-4
  Acceptance: Gate fails on new six-dimensional primary writes or exposed contracts outside approved adapters.
  Evidence: Gate tests.
  Reviewer Check: Confirm exemptions are narrow, named, and migration-only.
- [ ] Task 5: Update docs and regression tests.
  Covers: AC-5
  Acceptance: Docs and tests no longer describe six dimensions as current primary model.
  Evidence: Documentation diff and test output.
  Reviewer Check: Confirm project docs align with runtime behavior.
- [ ] Task 6: Run validation and prepare review evidence.
  Covers: AC-6
  Acceptance: OpenSpec validation, issue-body validation, and focused tests pass.
  Evidence: Command output in implementation summary.
  Reviewer Check: Confirm all AC ids have evidence and no AC is self-approved.

## Agent Guardrails

- Only execute this issue's change.
- Do not reintroduce six-dimensional primary portrait presentation.
- Do not hide missing portrait data as a UI-only workaround.
- Keep compatibility adapters explicit and migration-scoped.
- Do not leave `StudentEvidenceFeatureCache`, `LearningRecommendation`, or `ClassCompetencySnapshot` as hidden six-dimensional primary backchannels.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
