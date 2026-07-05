---
change_id: close-graph-resource-coverage-backlog
claim_branch: close-graph-resource-coverage-backlog
series: resource-path-readiness
coupling_group: resource-path-readiness-2026-07
execution_mode: stacked
base_branch: integration
required_branch:
depends_on:
  - complete-foundation-graph-resource-bindings
  - complete-analysis-design-graph-resource-bindings
  - complete-simulation-transfer-graph-bindings
  - review-runtime-lesson-planning-units
  - review-runtime-media-handout-dispositions
  - review-core-textbook-section-path-roles
  - review-reference-section-path-roles
  - complete-learning-goal-assessment-baselines
parent_issue: 786
blocked_by:
  - complete-foundation-graph-resource-bindings
  - complete-analysis-design-graph-resource-bindings
  - complete-simulation-transfer-graph-bindings
  - review-runtime-lesson-planning-units
  - review-runtime-media-handout-dispositions
  - review-core-textbook-section-path-roles
  - review-reference-section-path-roles
  - complete-learning-goal-assessment-baselines
blocking:
  - close-resource-disposition-review-backlog
openspec_path: openspec/changes/close-graph-resource-coverage-backlog
risk: high
area: resource-governance
---

## Goal

Close the current graph-node-resource-missing backlog so every graph node is either linked to reviewed resources or has a reviewed, actionable limitation state.

## Scope

- Consume the helper workqueue for the current 541 graph-node-resource-missing findings after upstream graph/resource batches.
- Manually bind remaining graph nodes to reviewed resources where suitable.
- Mark nodes without suitable resources with reviewed limitation states and gap categories.
- Preserve citation/path/assessment/remediation/terminal-validation distinctions.

## Out of Scope

- Do not promote provisional SAR/RAG suggestions as final refs.
- Do not make citation-only refs path-eligible.
- Do not complete unrelated resource disposition backlog.

## Acceptance Checklist

- [ ] AC-1: Every remaining graph-node-resource-missing finding from the helper workqueue is reviewed. Owner: independent reviewer.
  Evidence: helper before/after output with the 541-finding baseline or refreshed current baseline.
- [ ] AC-2: Each graph node is either linked to reviewed resources or has an actionable reviewed limitation state. Owner: independent reviewer.
  Evidence: graph coverage overlay and helper output.
- [ ] AC-3: Coverage outputs distinguish citation support, path support, assessment support, remediation, terminal validation, and explicit gaps. Owner: independent reviewer.
  Evidence: graph coverage overlay tests or helper snapshot output.

## Tasks

- [ ] Task 1: Generate residual graph-node workqueue.
  Covers: AC-1
  Acceptance: The workqueue enumerates every remaining `graph-node-resource-missing` finding after upstream graph/resource batches.
  Evidence: helper workqueue output with current and remaining graph-node-resource-missing totals.
  Reviewer Check: Confirm foundation, analysis/design, and simulation/transfer batches are not counted twice.
- [ ] Task 2: Bind remaining graph nodes item by item or create reviewed gaps.
  Covers: AC-1, AC-2
  Acceptance: Every remaining graph node receives reviewed resource refs or a reviewed limitation state with actionable category.
  Evidence: graph coverage helper before/after output.
  Reviewer Check: Confirm SAR/RAG suggestions were not accepted without implementing-agent per-record rationale.
- [ ] Task 3: Validate graph coverage closure.
  Covers: AC-2, AC-3
  Acceptance: The helper reports zero unexplained `graph-node-resource-missing` findings, or reports only reviewed limitation states, and baseline overlays expose remaining limitation categories.
  Evidence: `rtk openspec validate close-graph-resource-coverage-backlog --strict`, data-completeness helper, and graph coverage overlay output.
  Reviewer Check: Confirm citation-only resources and provisional metadata do not count as path-eligible coverage.

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
