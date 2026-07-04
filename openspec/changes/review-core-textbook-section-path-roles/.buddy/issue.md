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

- [ ] Task 1: Generate core textbook section worklist.
  Covers: AC-1
  Acceptance: Worklist targets core textbook sections and excludes reference-only sources.
  Evidence: helper workqueue output.
  Reviewer Check: Confirm chunk-level records are not primary path candidates.
- [ ] Task 2: Manually review section path roles.
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
- Do not auto-promote semantic fields from scripts, SAR, RAG, or model suggestions without human review.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
