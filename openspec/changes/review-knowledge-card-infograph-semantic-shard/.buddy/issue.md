---
change_id: review-knowledge-card-infograph-semantic-shard
claim_branch: review-knowledge-card-infograph-semantic-shard
series: resource-path-readiness
coupling_group: resource-path-readiness-2026-07
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue: 786
blocked_by: []
blocking:
  - enforce-all-resource-path-readiness-gate
openspec_path: openspec/changes/review-knowledge-card-infograph-semantic-shard
risk: high
area: resource-governance
---

## Goal

Complete a bounded semantic-review shard for knowledge cards and infographs so high-visibility graph/Konling/path resources no longer remain an obvious completeness shortfall.

## Execution Clarification

- This issue is executable by agents. Semantic review is required and must be done item by item.
- Buddy completion means `remaining:0` for the selected knowledge-card/infograph shard, not for every knowledge visual in the project.
- This issue must not block Yang Fan fixture data completion.

## Scope

- Select a deterministic knowledge-card/infograph shard from helper output.
- Review selected resources against source content, graph nodes, LearningGoal, K/A/Q objectives, route/citation, authority, evidence, privacy, and source hash.
- Classify every selected resource with reviewed path disposition or exclusion rationale.
- Preserve before/after helper evidence and residual unselected counts.

## Out of Scope

- Do not review textbook/reference sections in this issue.
- Do not promote display-only images or descriptions as PathNodes.
- Do not create fixture learner data.

## Acceptance Checklist

- [ ] AC-1: The selected knowledge-card/infograph shard has stable selected ids, blocker codes, and residual unselected counts. Owner: independent reviewer.
  Evidence: helper workqueue output.
- [ ] AC-2: Every selected resource has reviewed disposition, semantic mapping, source hash, and per-record rationale. Owner: independent reviewer.
  Evidence: ResourceNode semantic diff and helper output.
- [ ] AC-3: Selected grounding/citation metadata resolves through server-owned citation contracts or explicit limitation states. Owner: independent reviewer.
  Evidence: RAG/citation helper or targeted test output.

## Tasks

- [ ] Task 1: Select the deterministic knowledge visual shard.
  Covers: AC-1
  Acceptance: Shard prioritizes active LearningGoals and graph nodes used by planner/Konling tests.
  Evidence: helper workqueue output.
  Reviewer Check: Confirm selected denominator is bounded and reproducible.
- [ ] Task 2: Review selected resources item by item.
  Covers: AC-2
  Acceptance: Selected resources have reviewed graph, LearningGoal, K/A/Q, disposition, authority, evidence, privacy, source hash, and rationale fields.
  Evidence: source diff and helper output.
  Reviewer Check: Confirm ambiguous or display-only items are not promoted.
- [ ] Task 3: Verify citation and PathNode boundaries.
  Covers: AC-3
  Acceptance: Grounding links use server-owned citation metadata; supporting-only visuals do not become PathNodes.
  Evidence: RAG/citation helper or targeted test output.
  Reviewer Check: Confirm citation limitations remain visible where anchors are incomplete.
- [ ] Task 4: Validate and report residual backlog.
  Covers: AC-1, AC-2, AC-3
  Acceptance: OpenSpec validation passes and helper output reports selected shard outcome plus residual unselected rows.
  Evidence: `rtk openspec validate review-knowledge-card-infograph-semantic-shard --strict`.
  Reviewer Check: Confirm the issue does not block Yang Fan fixture completion.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Preserve before/after helper evidence for this batch.
- Do not bulk-promote semantic fields from scripts, SAR, RAG, or model suggestions.
- Do not mark the issue `needs-human` merely because semantic review is required.
- Do not use a global helper denominator as the PR completion gate when this issue selects a shard.
- Do not add blockedBy or dependency edges from this issue to `seed-yangfan-diagnostic-learning-state`.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
