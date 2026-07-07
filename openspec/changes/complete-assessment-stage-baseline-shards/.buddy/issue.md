---
change_id: complete-assessment-stage-baseline-shards
claim_branch: complete-assessment-stage-baseline-shards
series: resource-path-readiness
coupling_group: resource-path-readiness-2026-07
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue: 786
blocked_by: []
blocking: []
openspec_path: openspec/changes/complete-assessment-stage-baseline-shards
risk: high
area: assessment
---

## Goal

Complete a bounded next shard of the lowest-completeness LearningGoal assessment-stage baseline so path planning no longer has diagnostic/practice/checkpoint/remediation as a visible zero-coverage shortfall for the selected cells.

## Execution Clarification

- This issue is executable by agents. Semantic review is the implementation method, not a `needs-human` reason.
- Buddy completion means `remaining:0` for the selected deterministic shard, plus explicit residual counts for unselected assessment rows. It does not claim global assessment completeness.
- This issue must not add a blockedBy relation to `seed-yangfan-diagnostic-learning-state` and must not block test-account fixture data completion.
- This issue contributes follow-up evidence for the final readiness gate, but it MUST NOT be added as a GitHub blockedBy edge to an already claimed or in-progress `enforce-all-resource-path-readiness-gate` issue.

## Scope

- Select a deterministic shard from the lowest-completeness LearningGoal/stage cells reported by helper output.
- Reuse existing registered item sources first.
- Review every counted item item by item against source content and record per-item rationale.
- Author minimum new items only when no existing item satisfies the selected cell after review.

## Out of Scope

- Do not implement runtime next-question selection.
- Do not clear the whole assessment backlog.
- Do not mark generated suggestions as reviewed semantic decisions.
- Do not create or mutate Yang Fan fixture data.

## Acceptance Checklist

- [ ] AC-1: The selected shard has a stable denominator, selected row ids, selected LearningGoal/stage cells, and residual unselected counts. Owner: independent reviewer.
  Evidence: helper workqueue or coverage matrix output.
- [ ] AC-2: Every counted item in the selected shard has implementing-agent item-by-item semantic review and per-item rationale. Owner: independent reviewer.
  Evidence: semantic review diff and coverage output.
- [ ] AC-3: The selected shard improves diagnostic, practice, checkpoint, or remediation coverage without claiming global completion or blocking fixture data. Owner: independent reviewer.
  Evidence: before/after assessment coverage output and issue dependency check.

## Tasks

- [ ] Task 1: Select the deterministic assessment shard.
  Covers: AC-1
  Acceptance: The shard targets the lowest-completeness cells and records selected/residual counts.
  Evidence: helper workqueue or coverage matrix output.
  Reviewer Check: Confirm the shard is bounded enough for one implementation issue.
- [ ] Task 2: Review existing candidates item by item.
  Covers: AC-2
  Acceptance: Counted items include reviewed LearningGoal, K/A/Q, graph, stage, difficulty, cognitive, misconception/remediation, source hash, and rationale fields.
  Evidence: semantic review diff and coverage output.
  Reviewer Check: Confirm broad or ambiguous items are rejected rather than counted.
- [ ] Task 3: Author minimal new items for selected gaps.
  Covers: AC-2, AC-3
  Acceptance: New items exist only where selected cells cannot be satisfied from existing sources.
  Evidence: source diff and coverage output.
  Reviewer Check: Confirm new items align with selected LearningGoal/stage semantics.
- [ ] Task 4: Validate and report residual backlog.
  Covers: AC-1, AC-3
  Acceptance: OpenSpec validation passes and helper output shows selected shard outcome plus residual unselected rows.
  Evidence: `rtk openspec validate complete-assessment-stage-baseline-shards --strict` and targeted helper/test output.
  Reviewer Check: Confirm the issue does not block Yang Fan fixture completion.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Preserve before/after helper evidence for this batch.
- Do not bulk-promote semantic fields from scripts, SAR, RAG, or model suggestions. Helpers may generate workqueues, candidate relations, evidence snippets, and audits, but the implementing agent must perform item-by-item semantic review against source content and write per-record rationale before applying semantic fields.
- Do not mark the issue `needs-human` merely because semantic review is required.
- Do not use a global helper denominator as the PR completion gate when this issue selects a shard.
- Do not add blockedBy or dependency edges from this issue to `seed-yangfan-diagnostic-learning-state`.
- Do not retroactively block an already claimed or in-progress final readiness gate issue; report residual coverage improvements as follow-up evidence instead.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
