---
change_id: review-core-textbook-section-path-roles
claim_branch: review-core-textbook-section-path-roles
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
  - close-resource-disposition-review-backlog
  - complete-rag-citation-anchor-coverage
  - review-reference-section-path-roles
openspec_path: openspec/changes/review-core-textbook-section-path-roles
risk: high
area: authoring-resources
---

## Goal

Review core automatic-control textbook sections at section grain and classify them for path planning, supporting citation, remediation, or exclusion.

## Execution Clarification

- Supersedes earlier needs-human comments on this issue; those comments identified a missing scoped worklist and section/chunk boundary ambiguity, not a requirement for external human review.
- This issue is executable by agents. If the generated queues do not expose a `review-core-textbook-section-path-roles` bucket, Task 1 includes adding or repairing that scoped section-level workqueue before semantic review.
- The implementation target is reviewed section-level records from the scoped core-textbook queue or deterministic shard emitted by Task 1. Chunk/search-document records may only remain supporting evidence unless separately reviewed through their parent section.

## Scope

- Prioritize core course textbooks used for automatic-control foundations, analysis, design, and simulation topics.
- Promote only reviewed section-level units, not paragraph chunks, figure descriptions, or raw retrieval chunks.
- Link reviewed sections to LearningGoals, graph nodes, prerequisite position, estimated time, and citation addresses.

## Out of Scope

- Do not process broad reference/encyclopedia sections in this change.
- Do not make raw chunks path-plannable.

## Acceptance Checklist

- [ ] AC-1: Core textbook sections have reviewed path roles or exclusion rationale. Owner: independent reviewer.
  Evidence: long-form section workqueue output.
- [ ] AC-2: Promoted sections include graph, LearningGoal, prerequisite, time, authority, citation, privacy, and review metadata. Owner: independent reviewer.
  Evidence: ResourceNode and RAG audit output.
- [ ] AC-3: Raw chunks, figures, captions, and anchors remain supporting resources unless linked to reviewed parent sections. Owner: independent reviewer.
  Evidence: helper output.

## Tasks

- [ ] Task 1: Generate or repair scoped core textbook section worklist.
  Covers: AC-1
  Acceptance: Worklist targets only core textbook section-level records, excludes reference-only sources and raw retrieval chunks, and groups rows by textbook, chapter, graph domain, blocker type, and deterministic shard.
  Evidence: helper workqueue output.
  Reviewer Check: Confirm chunk-level records are not primary path candidates.
- [ ] Task 2: Review section path roles item by item.
  Covers: AC-1, AC-2
  Acceptance: Sections are assigned path/support/remediation/exclusion roles with rationale.
  Evidence: source diff and helper output.
  Reviewer Check: Confirm graph/LearningGoal mapping is semantically valid.
- [ ] Task 3: Validate section/chunk boundary.
  Covers: AC-3
  Acceptance: Chunks and figures cite through parent sections unless separately reviewed.
  Evidence: helper and RAG output.
  Reviewer Check: Confirm no raw chunk becomes a PathNode.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Preserve before/after helper evidence for this batch.
- Do not bulk-promote semantic fields from scripts, SAR, RAG, or model suggestions. Helpers may generate workqueues, candidate relations, evidence snippets, and audits, but the implementing agent must perform item-by-item semantic review against source content and write per-record rationale before applying any semantic field.
- Do not mark the issue `needs-human` merely because semantic review is required; split the work into bounded batches and leave unreviewed records in the workqueue if the full queue cannot be completed in one run.
- Do not mark the issue `needs-human` because the current helper lacks a scoped core-textbook section bucket; repair the scoped workqueue first, then process the bounded section queue.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
