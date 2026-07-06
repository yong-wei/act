---
change_id: review-textbook-search-document-citation-shard
claim_branch: review-textbook-search-document-citation-shard
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
openspec_path: openspec/changes/review-textbook-search-document-citation-shard
risk: high
area: authoring-resources
---

## Goal

Classify a bounded textbook search-document shard for citation/RAG readiness while preserving the rule that raw retrieval/search rows do not become path nodes.

## Execution Clarification

- This issue is executable by agents. Semantic review is required and must be done row by row against parent section and citation context.
- Buddy completion means `remaining:0` for the selected deterministic search-document shard, not for all textbook-search-document rows.
- This issue must not block Yang Fan fixture data completion.

## Scope

- Select a deterministic search-document shard from the largest current completeness deficit.
- Review selected rows against parent section, citation anchor, graph refs, authority, privacy, source hash, limitation state, and rationale.
- Keep raw search-document rows citation/support-only unless their parent section is separately reviewed.
- Preserve before/after helper evidence and residual unselected counts.

## Out of Scope

- Do not promote raw search-document rows to PathNodes.
- Do not review every textbook, figure, or caption row in this issue.
- Do not create fixture learner data.

## Acceptance Checklist

- [ ] AC-1: The selected search-document shard has stable selected ids, parent refs, blocker codes, and residual unselected counts. Owner: independent reviewer.
  Evidence: helper workqueue output.
- [ ] AC-2: Every selected row has reviewed citation/support/exclusion classification, source hash, limitation state, and per-row rationale. Owner: independent reviewer.
  Evidence: semantic review diff and helper output.
- [ ] AC-3: Raw search-document rows remain out of path planning and cite through parent sections or citation targets. Owner: independent reviewer.
  Evidence: ResourceNode/RAG audit or targeted tests.

## Tasks

- [ ] Task 1: Select the deterministic search-document shard.
  Covers: AC-1
  Acceptance: Shard prioritizes active LearningGoals, reviewed parent sections, or high-priority graph domains and records residual counts.
  Evidence: helper workqueue output.
  Reviewer Check: Confirm the selected denominator is bounded and reproducible.
- [ ] Task 2: Review selected rows item by item.
  Covers: AC-2
  Acceptance: Selected rows have reviewed parent/citation, graph, authority, privacy, source hash, limitation, and rationale fields.
  Evidence: semantic review diff and helper output.
  Reviewer Check: Confirm unsupported rows are limited or excluded, not silently verified.
- [ ] Task 3: Verify long-form boundary behavior.
  Covers: AC-3
  Acceptance: Search-document rows remain supporting records and do not become PathNodes.
  Evidence: ResourceNode/RAG audit or targeted tests.
  Reviewer Check: Confirm parent-section dependencies are reported separately.
- [ ] Task 4: Validate and report residual backlog.
  Covers: AC-1, AC-2, AC-3
  Acceptance: OpenSpec validation passes and helper output reports selected shard outcome plus residual unselected rows.
  Evidence: `rtk openspec validate review-textbook-search-document-citation-shard --strict`.
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
