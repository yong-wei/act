---
change_id: complete-core-teaching-resource-path-readiness
claim_branch: complete-core-teaching-resource-path-readiness
series: resource-path-readiness
coupling_group: resource-path-readiness-2026-07
execution_mode: stacked
base_branch: integration
required_branch:
depends_on:
  - define-resource-path-disposition-governance
  - complete-graph-resource-semantic-coverage
parent_issue: 786
blocked_by:
  - define-resource-path-disposition-governance
  - complete-graph-resource-semantic-coverage
blocking:
  - enforce-all-resource-path-readiness-gate
openspec_path: openspec/changes/complete-core-teaching-resource-path-readiness
risk: high
area: resource-governance
---

## Goal

Make all helper-discovered existing core teaching resources genuinely available to path planning through manually reviewed semantic and evidence metadata, or classify them with reviewed limitation/exclusion rationale.

## Scope

- Complete all helper-discovered registered TeachingResources, runtime lesson planning units, knowledge cards, infographs, simulations, control workbench entries, Arena preview/terminal-validation resources, quizzes, exercises, and platform-managed practice resources.
- Use helper findings as the worklist and SAR/RAG only as semantic exploration aids.
- Regenerate affected runtime governance artifacts.

## Out of Scope

- Long-form textbook and reference section planning.
- Yang Fan fixture generation.
- Rewriting the planner algorithm.

## Acceptance Checklist

- [ ] AC-1: All helper-discovered in-scope core resources are resolved, classified, or reviewed as limitation/exclusion. Owner: independent reviewer.
  Evidence: before/after helper JSON or Markdown with family denominators, unaccounted counts, invalid promotion counts, unreviewed semantic counts, and remaining blocker counts.
- [ ] AC-2: Path-plannable core resources have manually reviewed graph, LearningGoal, path, route, evidence, privacy, and review metadata. Owner: independent reviewer.
  Evidence: changed resource metadata/projections plus review-state audit output.
- [ ] AC-3: Path generation can select a mix of core resource types for registered LearningGoals without hard-coded goal names. Owner: independent reviewer.
  Evidence: targeted planner tests or diagnostic path-generation runs.
- [ ] AC-4: Konling can cite governed core resources used by or relevant to generated paths. Owner: independent reviewer.
  Evidence: targeted citation/RAG test or diagnostic transcript with verified citations.

## Tasks

- [ ] Task 1: Define and complete the helper-driven full core-resource set.
  Covers: AC-1, AC-2
  Acceptance: The set includes every helper-discovered in-scope core resource across TeachingResource, runtime lesson, knowledge card, infograph, simulation, control workbench, Arena, quiz, exercise, and platform-managed practice families, and records manual review metadata or reviewed limitation/exclusion rationale.
  Evidence: helper report and changed resource governance files.
  Reviewer Check: Confirm family denominators match helper output and semantic fields are not script-filled without review.
- [ ] Task 2: Repair route, evidence, and policy blockers.
  Covers: AC-1, AC-2
  Acceptance: Missing route target, teacher-policy, unavailable, evidence-instrumentation, and readiness blockers are resolved or given reviewed exclusion rationale.
  Evidence: helper before/after findings with summarized layer totals and finding counts.
  Reviewer Check: Confirm unavailable resources are not silently promoted.
- [ ] Task 3: Validate planner and Konling consumption.
  Covers: AC-3, AC-4
  Acceptance: Paths include multiple governed core resource types and citations resolve through governed citation metadata.
  Evidence: targeted planner and citation tests.
  Reviewer Check: Confirm planner does not rely on hard-coded goal ids.
- [ ] Task 4: Validate OpenSpec and governance artifacts.
  Covers: AC-1, AC-2, AC-3, AC-4
  Acceptance: OpenSpec validation and resource governance checks pass.
  Evidence: `rtk openspec validate complete-core-teaching-resource-path-readiness --strict`.
  Reviewer Check: Confirm downstream gate issues remain blocked until this issue is complete.

## Agent Guardrails

- Start by running the data-completeness helper and preserve before/after output.
- Manually review knowledge, capability, LearningGoal, prerequisite, and path-role fields.
- Use SAR/RAG to discover candidate relations, not to auto-approve them.
- Preserve Arena official scoring and leaderboard authority.
- Do not execute other planned OpenSpec changes.
