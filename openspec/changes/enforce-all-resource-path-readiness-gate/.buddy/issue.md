---
change_id: enforce-all-resource-path-readiness-gate
claim_branch: enforce-all-resource-path-readiness-gate
series: resource-path-readiness
coupling_group: resource-path-readiness-2026-07
execution_mode: stacked
base_branch: integration
required_branch:
depends_on:
  - define-resource-path-disposition-governance
  - complete-core-teaching-resource-path-readiness
  - complete-longform-resource-path-readiness
  - complete-resource-evidence-lineage-readiness
  - unify-adaptive-assessment-item-catalog
  - add-assessment-item-semantic-review-workflow
  - complete-learning-goal-checkpoint-question-sets
  - wire-adaptive-engine-to-reviewed-item-catalog
parent_issue:
blocked_by:
  - define-resource-path-disposition-governance
  - complete-core-teaching-resource-path-readiness
  - complete-longform-resource-path-readiness
  - complete-resource-evidence-lineage-readiness
  - unify-adaptive-assessment-item-catalog
  - add-assessment-item-semantic-review-workflow
  - complete-learning-goal-checkpoint-question-sets
  - wire-adaptive-engine-to-reviewed-item-catalog
blocking:
  - seed-yangfan-diagnostic-learning-state
openspec_path: openspec/changes/enforce-all-resource-path-readiness-gate
risk: high
area: adaptive-learning
---

## Goal

Add the final gate proving that all existing resources are accounted for in path planning and every registered LearningGoal can generate governed paths or precise resource-gap diagnostics.

## Scope

- Gate full resource path readiness from helper output.
- Dynamically test all backend-registered LearningGoals.
- Verify resource diversity, citation resolution, helper summarized evidence, and non-hard-coded planner behavior.
- Ensure future imports of TeachingResources, runtime lessons, knowledge cards, infographs, simulations, control workbench entries, Arena resources, quizzes, exercises, textbooks, references, figures, transcripts, slides, media anchors, and image descriptions are audited until classified and reviewed.

## Out of Scope

- Completing upstream resource metadata.
- Creating Yang Fan fixture data.
- Replacing the path planner algorithm with bandit or reinforcement learning.

## Acceptance Checklist

- [ ] AC-1: Full-resource gate fails on missing disposition, invalid promotion, missing reviewed semantics, unexplained exclusion, and unresolved path blockers. Owner: independent reviewer.
  Evidence: full-resource gate tests and helper fixture output with resource family totals, unaccounted count, invalid promotion count, unreviewed semantic count, evidence-lineage blockers, follow-up buckets, and Yang Fan fixture blockers.
- [ ] AC-2: Every backend-registered LearningGoal is covered by path-generation diagnostics. Owner: independent reviewer.
  Evidence: diagnostic output enumerating the backend goal registry.
- [ ] AC-3: Goals with sufficient resources generate meaningful resource mixes rather than single-resource or cosmetic fallback paths. Owner: independent reviewer.
  Evidence: path diagnostic tests covering multiple resource families.
- [ ] AC-4: Path explanations and Konling path advice cite selected/supporting resources through governed citation metadata. Owner: independent reviewer.
  Evidence: citation resolver tests or diagnostic path/Konling transcript.
- [ ] AC-5: New resource imports cannot bypass path-readiness auditing. Owner: independent reviewer.
  Evidence: tests adding incomplete fixture resources for TeachingResources, runtime lessons, knowledge cards, infographs, simulations, control workbench entries, Arena resources, quizzes, exercises, textbooks, references, figures, transcripts, slides, media anchors, and image descriptions.

## Tasks

- [ ] Task 1: Implement full-resource readiness gate.
  Covers: AC-1, AC-5
  Acceptance: The gate consumes helper JSON and fails for unaccounted resources or invalid path promotion.
  Evidence: gate tests and helper fixture output.
  Reviewer Check: Confirm citation-ready-only resources are accepted only with reviewed supporting disposition.
- [ ] Task 2: Add all-LearningGoal path diagnostics.
  Covers: AC-2, AC-3
  Acceptance: Diagnostics enumerate backend goals dynamically and generate paths or exact resource-gap states.
  Evidence: diagnostic command/test output.
  Reviewer Check: Confirm no frontend or planner hard-coded goal name drives the test.
- [ ] Task 3: Add citation and explanation checks.
  Covers: AC-4
  Acceptance: Path explanations and Konling path advice cite selected/supporting resources through governed metadata.
  Evidence: citation resolver and path/Konling tests.
  Reviewer Check: Confirm model-authored URLs are not trusted as final citation links.
- [ ] Task 4: Validate OpenSpec and dependency readiness.
  Covers: AC-1, AC-2, AC-3, AC-4, AC-5
  Acceptance: OpenSpec validation, helper, full-resource gate, path diagnostics, and citation tests pass.
  Evidence: `rtk openspec validate enforce-all-resource-path-readiness-gate --strict`.
  Reviewer Check: Confirm all upstream resource, evidence, and assessment issues are complete before this issue is claimed.

## Agent Guardrails

- This is the final gate, not a metadata-completion shortcut.
- Do not script-fill semantic fields to satisfy the gate.
- Use helper output as the authoritative gap list.
- Use SAR/RAG to investigate candidate relations, then require manual review for accepted semantic fields.
- Preserve low-resource states when gaps are real; do not hide them as permission errors.
- Do not execute other planned OpenSpec changes.
