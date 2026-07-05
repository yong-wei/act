---
change_id: review-runtime-media-handout-dispositions
claim_branch: review-runtime-media-handout-dispositions
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
openspec_path: openspec/changes/review-runtime-media-handout-dispositions
risk: high
area: authoring-resources
---

## Goal

Classify runtime media, slides, audio, video, PDFs, and handouts into path-plannable, supporting-citation, embedded-asset, evidence-producing, or excluded dispositions.

## Execution Clarification

- Supersedes earlier needs-human comments on this issue; those comments identified a worklist/task boundary problem, not a requirement for external human review.
- This issue is executable by agents. If the generated workqueue includes non-media/handout families or omits handout rows behind identity repair, Task 1 includes repairing or adding the scoped workqueue/denominator before semantic review.
- The implementation target is the scoped runtime-media/handout queue or deterministic shard emitted by Task 1, not an unrelated global helper denominator. Worklist mismatch is implementation work, not a `needs-human` condition.

## Scope

- Review 904 runtime lesson media and 36 handout projections by lesson family and source hash.
- Define transcript/anchor needs for audio/video and page/figure anchors for slides/PDFs.
- Separate independent teaching resources from embedded assets and citation-only media.

## Out of Scope

- Do not manually transcribe all media in this change unless needed to classify anchor gaps.
- Do not promote media without launch target and evidence policy.

## Acceptance Checklist

- [ ] AC-1: Runtime media and handouts have reviewed path-planning dispositions. Owner: independent reviewer.
  Evidence: resource disposition helper output.
- [ ] AC-2: Citation-support media declare required anchors, transcripts, page refs, or limitation states. Owner: independent reviewer.
  Evidence: citation readiness output.
- [ ] AC-3: Path-plannable media declare evidence contract, privacy policy, graph binding, and parent/route semantics. Owner: independent reviewer.
  Evidence: ResourceNode audit output.

## Tasks

- [ ] Task 1: Generate or repair scoped media/handout worklist.
  Covers: AC-1
  Acceptance: Worklist groups only runtime media and handouts by lesson, kind, blocker type, and deterministic shard; non-media/handout families are excluded, and identity-repaired handout rows are included.
  Evidence: helper workqueue output.
  Reviewer Check: Confirm textbook sections and runtime steps are excluded.
- [ ] Task 2: Review dispositions and anchor requirements.
  Covers: AC-1, AC-2
  Acceptance: Each media/handout record has disposition and citation anchor state.
  Evidence: helper and citation readiness output.
  Reviewer Check: Confirm citation-only media are not promoted as PathNodes.
- [ ] Task 3: Complete path metadata for independent media.
  Covers: AC-3
  Acceptance: Independent media have route, evidence, privacy, and graph metadata.
  Evidence: ResourceNode audit output.
  Reviewer Check: Confirm launch and access policy are valid.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Preserve before/after helper evidence for this batch.
- Do not bulk-promote semantic fields from scripts, SAR, RAG, or model suggestions. Helpers may generate workqueues, candidate relations, evidence snippets, and audits, but the implementing agent must perform item-by-item semantic review against source content and write per-record rationale before applying any semantic field.
- Do not mark the issue `needs-human` merely because semantic review is required; split the work into bounded batches and leave unreviewed records in the workqueue if the full queue cannot be completed in one run.
- Do not mark the issue `needs-human` because the current helper queue is unscoped or mismatched; repair the scoped media/handout workqueue first, then process the bounded queue.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
