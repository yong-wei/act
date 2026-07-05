---
change_id: review-runtime-lesson-planning-units
claim_branch: review-runtime-lesson-planning-units
series: resource-path-readiness
coupling_group: resource-path-readiness-2026-07
execution_mode: stacked
base_branch: integration
required_branch:
depends_on:
  - add-resource-completion-workqueues
  - repair-resource-identity-bindings
parent_issue: 786
blocked_by:
  - add-resource-completion-workqueues
  - repair-resource-identity-bindings
blocking:
  - close-graph-resource-coverage-backlog
  - close-resource-disposition-review-backlog
  - complete-rag-citation-anchor-coverage
openspec_path: openspec/changes/review-runtime-lesson-planning-units
risk: high
area: interactive
---

## Goal

Review runtime lesson steps and promote only valid steps to PlanningUnit or classify them as supporting, embedded, evidence-producing, or excluded resources.

## Scope

- Use helper workqueues to split runtime lesson steps by lesson, LearningGoal, and missing fields.
- The implementing agent reviews step title, route target, graph binding, capability target, estimated time, evidence behavior, and prerequisite role item by item against source content.
- Add reviewed disposition and parent/child relationships for non-planning steps.

## Out of Scope

- Do not review runtime media files in this change.
- Do not alter course content semantics unless needed to repair missing route identity.

## Acceptance Checklist

- [ ] AC-1: Runtime lesson steps are classified with reviewed disposition. Owner: independent reviewer.
  Evidence: runtime projection helper output.
- [ ] AC-2: Promoted PlanningUnits have route, graph, path, evidence, privacy, and review metadata. Owner: independent reviewer.
  Evidence: ResourceNode audit output.
- [ ] AC-3: Non-planning steps link to parent PlanningUnit, supporting citation, embedded asset, or reviewed exclusion rationale. Owner: independent reviewer.
  Evidence: disposition audit output.

## Tasks

- [ ] Task 1: Generate runtime step worklist.
  Covers: AC-1
  Acceptance: Worklist groups runtime lesson steps by lesson and missing field codes.
  Evidence: helper workqueue output.
  Reviewer Check: Confirm media and long-form resources are out of scope.
- [ ] Task 2: Review step PlanningUnit eligibility.
  Covers: AC-1, AC-2
  Acceptance: Eligible steps are promoted only with full required metadata.
  Evidence: ResourceNode audit output.
  Reviewer Check: Confirm route targets are real and evidence contracts are complete.
- [ ] Task 3: Classify non-planning runtime steps.
  Covers: AC-3
  Acceptance: Non-planning steps are linked or excluded with rationale.
  Evidence: disposition audit output.
  Reviewer Check: Confirm no orphan segment remains unexplained.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Preserve before/after helper evidence for this batch.
- Do not bulk-promote semantic fields from scripts, SAR, RAG, or model suggestions. Helpers may generate workqueues, candidate relations, evidence snippets, and audits, but the implementing agent must perform item-by-item semantic review against source content and write per-record rationale before applying any semantic field.
- Do not mark the issue `needs-human` merely because semantic review is required; split the work into bounded batches and leave unreviewed records in the workqueue if the full queue cannot be completed in one run.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
