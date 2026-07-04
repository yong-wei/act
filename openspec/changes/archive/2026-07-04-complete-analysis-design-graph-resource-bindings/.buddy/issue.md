---
change_id: complete-analysis-design-graph-resource-bindings
claim_branch: complete-analysis-design-graph-resource-bindings
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
openspec_path: openspec/changes/complete-analysis-design-graph-resource-bindings
risk: high
area: resource-governance
---

## Goal

Manually bind analysis/design graph nodes to reviewed resources and expose remaining instructional gaps.

## Scope

- Cover the analysis/design-domain slice of the current 541 graph-node-resource-missing findings; remaining graph nodes must flow to `close-graph-resource-coverage-backlog` with explicit gaps.
- Cover root-locus-analysis-foundations, frequency-response-foundations, stability-margin-frequency-analysis, and control-correction target nodes.
- Review resource candidates from knowledge cards, runtime lessons, handouts, textbooks, exercises, simulations, and Arena/context resources.
- Keep terminal-validation and assessment semantics separate from ordinary concept resources.

## Out of Scope

- Do not complete simulation-transfer-only nodes in this batch.
- Do not satisfy checkpoint/remediation with unreviewed questions.

## Acceptance Checklist

- [ ] AC-1: Analysis/design graph nodes have reviewed resource refs or explicit gap states. Owner: independent reviewer.
  Evidence: graph resource helper output.
- [ ] AC-2: Bindings identify concept, citation, practice, checkpoint, remediation, and terminal-validation candidate roles without conflating them. Owner: independent reviewer.
  Evidence: baseline matrix and ResourceNode audit output.
- [ ] AC-3: Zero-path-eligible state for stability-margin-frequency-analysis is addressed or precisely explained. Owner: independent reviewer.
  Evidence: LearningGoal baseline limitation output.

## Tasks

- [ ] Task 1: Generate analysis/design binding worklist.
  Covers: AC-1
  Acceptance: Worklist covers stability, steady-state, root-locus, frequency-response, margin, and correction-design nodes.
  Evidence: helper workqueue output.
  Reviewer Check: Confirm foundation and simulation-transfer-only items are excluded.
- [ ] Task 2: Manually review and bind analysis/design resources.
  Covers: AC-1, AC-2
  Acceptance: Accepted bindings have rationale, role, and version evidence.
  Evidence: source diff and helper output.
  Reviewer Check: Confirm role labels are not inferred only from titles.
- [ ] Task 3: Validate affected LearningGoal baseline coverage.
  Covers: AC-2, AC-3
  Acceptance: Baseline limitations shrink or become actionable for analysis/design goals.
  Evidence: baseline matrix and limitations diff.
  Reviewer Check: Confirm no unreviewed item is promoted to checkpoint or terminal validation.

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
