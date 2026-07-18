---
change_id: align-path-planner-with-resource-center-registry
claim_branch: align-path-planner-with-resource-center-registry
series: resource-semantic-completion-closure
coupling_group: resource-planner-governance
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue: 876
blocked_by: []
blocking: []
openspec_path: openspec/changes/align-path-planner-with-resource-center-registry
risk: medium
area: adaptive-learning
---

## Goal

Make adaptive path generation consume the same governed ResourceNode candidate pool as the resource center, so resource semantic completion can actually affect generated paths.

## Scope

- Align production path-generation candidate loading with the resource-center ResourceNode projection.
- Include audited runtime projections, runtime lessons, media/handout dispositions, textbook/reference PlanningUnits, registered resources, and generated checkpoint contracts.
- Add diagnostics for candidate family counts, registry/projection versions, and missing source families.
- Preserve the rule that retrieval chunks and citation-only rows cannot become PathNodes without audited PlanningUnits.

## Out of Scope

- Completing resource semantics for individual resources.
- Changing LearningGoal K/A/Q boundary rules.
- Redesigning path comparison UI.
- Adding new resource types or new RAG ranking behavior.

## Acceptance Checklist

- [ ] AC-1: Production path-generation entrypoints load governed candidates through the unified ResourceNode projection. Owner: independent reviewer.
  Evidence: focused unit tests and implementation diff for planner/resource registry loading.
- [ ] AC-2: Path diagnostics expose registry version, projection version, candidate counts by family, excluded counts, and missing-source reasons. Owner: independent reviewer.
  Evidence: diagnostic payload tests.
- [ ] AC-3: Retrieval-only records remain excluded from PathNode generation unless a reviewed PlanningUnit or ResourceNode authorizes path eligibility. Owner: independent reviewer.
  Evidence: regression tests for high-ranking chunk/search-document candidates.
- [ ] AC-4: OpenSpec and Buddy contracts remain valid. Owner: independent reviewer.
  Evidence: `rtk openspec validate align-path-planner-with-resource-center-registry --strict` and issue-body validation pass.

## Tasks

- [ ] Task 1: Replace partial path-generation registry loading with the unified ResourceNode registry projection.
  Covers: AC-1, AC-2
  Acceptance: Production path-generation entrypoints load all governed source families through one loader.
  Evidence: Unit tests and implementation diff in planner/resource registry loading code.
  Reviewer Check: Confirm no production entrypoint silently falls back to the older partial loader.
- [ ] Task 2: Add candidate-pool diagnostics.
  Covers: AC-2
  Acceptance: Diagnostics include registry version, projection version, family counts, excluded counts, and missing-source reasons.
  Evidence: Focused tests for diagnostic payload shape.
  Reviewer Check: Confirm diagnostics are privacy-safe and actionable.
- [ ] Task 3: Preserve PlanningUnit boundaries.
  Covers: AC-3
  Acceptance: Retrieval chunks, search documents, figures, captions, and citation targets cannot become PathNodes without audited ResourceNode authority.
  Evidence: Regression tests for high-ranking non-PlanningUnit candidates.
  Reviewer Check: Confirm ranking signals do not bypass ResourceNode eligibility.
- [ ] Task 4: Run validation and prepare review evidence.
  Covers: AC-4
  Acceptance: OpenSpec validation, issue-body validation, and focused planner/resource registry tests pass.
  Evidence: Command output in implementation summary.
  Reviewer Check: Confirm all evidence maps to AC ids and no AC is self-approved.

## Agent Guardrails

- Only execute this issue's change.
- Do not complete individual resource semantics in this issue.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
