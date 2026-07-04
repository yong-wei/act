---
change_id: complete-simulation-transfer-graph-bindings
claim_branch: complete-simulation-transfer-graph-bindings
series: resource-path-readiness
coupling_group: resource-path-readiness-2026-07
execution_mode: stacked
base_branch: integration
required_branch:
depends_on:
  - complete-foundation-graph-resource-bindings
  - complete-analysis-design-graph-resource-bindings
parent_issue: 786
blocked_by:
  - complete-foundation-graph-resource-bindings
  - complete-analysis-design-graph-resource-bindings
blocking:
  - close-graph-resource-coverage-backlog
  - complete-learning-goal-assessment-baselines
openspec_path: openspec/changes/complete-simulation-transfer-graph-bindings
risk: high
area: resource-governance
---

## Goal

Bind simulation-validation and ship-ocean transfer graph nodes to governed resources and classify remaining high-complexity gaps.

## Scope

- Cover the simulation/transfer-domain slice of the current 541 graph-node-resource-missing findings; remaining graph nodes must flow to `close-graph-resource-coverage-backlog` with explicit gaps.
- Cover simulation-validation-practice and ship-ocean-transfer-application target graph nodes.
- Review simulation, control workbench, Arena preview, terminal-validation, reflection, and transfer-application resources.
- Preserve official Arena scoring boundaries and preview/official distinction.

## Out of Scope

- Do not fabricate official Arena evidence.
- Do not reclassify foundational concept resources outside this transfer scope.

## Acceptance Checklist

- [ ] AC-1: Simulation-validation and transfer graph nodes have reviewed resource refs or explicit gaps. Owner: independent reviewer.
  Evidence: graph resource helper output.
- [ ] AC-2: High-complexity resources declare readiness and evidence authority boundaries. Owner: independent reviewer.
  Evidence: ResourceNode audit output.
- [ ] AC-3: The two zero-path-eligible LearningGoals gain reviewed candidates or narrow limitation states. Owner: independent reviewer.
  Evidence: LearningGoal baseline matrix diff.

## Tasks

- [ ] Task 1: Generate simulation/transfer worklist.
  Covers: AC-1
  Acceptance: Worklist targets simulation, workbench, Arena, reflection, and transfer application resources.
  Evidence: helper workqueue output.
  Reviewer Check: Confirm official and preview evidence families are separated.
- [ ] Task 2: Manually review high-complexity graph bindings.
  Covers: AC-1, AC-2
  Acceptance: Bindings include readiness, evidence authority, and limitation rationale.
  Evidence: source diff and audit output.
  Reviewer Check: Confirm official Arena authority is not inferred from preview resources.
- [ ] Task 3: Validate simulation and transfer baseline coverage.
  Covers: AC-3
  Acceptance: Baseline matrix shows reviewed coverage or precise limitations for simulation and ship-ocean goals.
  Evidence: baseline matrix diff.
  Reviewer Check: Confirm remaining gaps are actionable.

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
