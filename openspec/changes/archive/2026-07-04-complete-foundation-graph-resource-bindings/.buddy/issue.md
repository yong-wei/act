---
change_id: complete-foundation-graph-resource-bindings
claim_branch: complete-foundation-graph-resource-bindings
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
  - complete-learning-goal-assessment-baselines
  - complete-simulation-transfer-graph-bindings
  - review-core-textbook-section-path-roles
openspec_path: openspec/changes/complete-foundation-graph-resource-bindings
risk: high
area: resource-governance
---

## Goal

Manually bind foundation-domain graph nodes to existing resources and classify insufficient nodes with actionable gaps.

## Scope

- Cover the foundation-domain slice of the current 541 graph-node-resource-missing findings; remaining graph nodes must flow to `close-graph-resource-coverage-backlog` with explicit gaps.
- Cover feedback-loop-concept-foundations, transfer-function-modeling-foundations, and time-domain-response-analysis target nodes.
- Use helper workqueues, SAR/RAG candidate search, and human review to choose resources.
- Update graph-resource coverage artifacts or source records according to existing ownership rules.

## Out of Scope

- Do not review root-locus, frequency-margin, simulation-transfer, or advanced design nodes in this batch.
- Do not fabricate resource refs when no suitable resource exists.

## Acceptance Checklist

- [ ] AC-1: Foundation-domain graph nodes have reviewed resource refs or explicit gap states. Owner: independent reviewer.
  Evidence: graph resource helper before/after output.
- [ ] AC-2: Bindings distinguish citation-ready resources from path-eligible resources. Owner: independent reviewer.
  Evidence: coverage overlay and ResourceNode audit output.
- [ ] AC-3: LearningGoal baseline concept coverage improves for foundation goals without provisional promotion. Owner: independent reviewer.
  Evidence: LearningGoal baseline matrix diff.

## Tasks

- [ ] Task 1: Generate foundation graph binding worklist.
  Covers: AC-1
  Acceptance: Worklist is filtered to foundation goals and target graph nodes.
  Evidence: helper workqueue output.
  Reviewer Check: Confirm no non-foundation domain is included.
- [ ] Task 2: Manually review and bind resources.
  Covers: AC-1, AC-2
  Acceptance: Each accepted binding has semantic rationale and correct disposition boundary.
  Evidence: data/source diff plus helper output.
  Reviewer Check: Confirm SAR/RAG suggestions were treated as candidates, not final truth.
- [ ] Task 3: Validate foundation LearningGoal coverage.
  Covers: AC-3
  Acceptance: Baseline matrix shows improved foundation concept coverage and no invalid path promotion.
  Evidence: baseline matrix and helper output.
  Reviewer Check: Confirm provisional metadata does not count as human-confirmed coverage.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Preserve before/after helper evidence for this batch.
- Do not auto-promote semantic fields from scripts, SAR, RAG, or model suggestions without human review.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
