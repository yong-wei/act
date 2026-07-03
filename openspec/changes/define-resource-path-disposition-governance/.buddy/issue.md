---
change_id: define-resource-path-disposition-governance
claim_branch: define-resource-path-disposition-governance
series: resource-path-readiness
coupling_group: resource-path-readiness-2026-07
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking:
  - complete-core-teaching-resource-path-readiness
  - complete-longform-resource-path-readiness
  - complete-resource-evidence-lineage-readiness
  - enforce-all-resource-path-readiness-gate
openspec_path: openspec/changes/define-resource-path-disposition-governance
risk: medium
area: data-governance
---

## Goal

Define the governance contract that lets every existing resource enter path planning with a reviewed disposition, without forcing every chunk or asset to become a PathNode.

## Scope

- Add resource path-planning disposition semantics.
- Extend helper expectations to report disposition gaps.
- Preserve ResourceNode authority over PathNode promotion.

## Out of Scope

- Completing all resource metadata.
- Changing path planner selection behavior.
- Creating Yang Fan learner fixture data.

## Acceptance Checklist

- [ ] AC-1: Every inventoried resource family has a defined path-planning disposition contract. Owner: independent reviewer.
  Evidence: OpenSpec delta and tests covering path-plannable, supporting-citation, embedded-asset, evidence-producing, and excluded resources.
- [ ] AC-2: The completeness helper exposes missing disposition and invalid promotion gaps without mutating data. Owner: independent reviewer.
  Evidence: helper output or tests showing stable findings for missing disposition, missing parent PlanningUnit, and missing exclusion rationale.
- [ ] AC-3: Retrieval chunks and citation targets remain blocked from direct PathNode promotion unless backed by audited ResourceNode or checkpoint contracts. Owner: independent reviewer.
  Evidence: targeted ResourceNode/planner governance tests.

## Tasks

- [ ] Task 1: Implement disposition schema and promotion rules.
  Covers: AC-1, AC-3
  Acceptance: Resource governance distinguishes path-plannable resources from citation, embedded, evidence, and excluded resources.
  Evidence: changed ResourceNode governance code and targeted tests.
  Reviewer Check: Confirm provisional SAR/RAG/script suggestions do not satisfy human-reviewed promotion.
- [ ] Task 2: Extend helper findings.
  Covers: AC-2
  Acceptance: Helper reports disposition gaps and invalid promotion with stable refs and follow-up buckets.
  Evidence: `rtk npm run db:data-completeness-audit -- --format json --compact`.
  Reviewer Check: Confirm helper remains read-only and privacy-minimized.
- [ ] Task 3: Validate OpenSpec and tests.
  Covers: AC-1, AC-2, AC-3
  Acceptance: OpenSpec validation and targeted governance tests pass.
  Evidence: `rtk openspec validate define-resource-path-disposition-governance --strict`.
  Reviewer Check: Confirm the issue checklist maps to implemented tasks and no unrelated resource completion is included.

## Agent Guardrails

- Use the data-completeness helper to identify current gaps.
- Use SAR/RAG only to propose semantic relations; manually review semantic fields before promotion.
- Do not treat a retrieval chunk, citation target, transcript segment, figure description, or slide fragment as an independent PathNode without audited ResourceNode authority.
- Do not execute other planned OpenSpec changes.
