---
change_id: review-reference-section-path-roles
claim_branch: review-reference-section-path-roles
series: resource-path-readiness
coupling_group: resource-path-readiness-2026-07
execution_mode: stacked
base_branch: integration
required_branch:
depends_on:
  - review-core-textbook-section-path-roles
parent_issue: 786
blocked_by:
  - review-core-textbook-section-path-roles
blocking:
  - close-graph-resource-coverage-backlog
  - close-resource-disposition-review-backlog
  - complete-rag-citation-anchor-coverage
openspec_path: openspec/changes/review-reference-section-path-roles
risk: high
area: authoring-resources
---

## Goal

Classify reference-resource sections as supporting citation, remediation, extension, enrichment, or excluded resources, with reviewed path promotion only for suitable sections.

## Scope

- Review reference and encyclopedia sections by source family and graph/LearningGoal candidate fit.
- Prioritize sections that fill gaps left after core textbook review.
- Mark advanced, duplicate, off-topic, copyright-restricted, or unsuitable material with explicit rationale.

## Out of Scope

- Do not re-review core textbook sections already covered by the prior change.
- Do not treat broad reference availability as proof of path suitability.

## Acceptance Checklist

- [ ] AC-1: Reference sections have reviewed roles or explicit exclusion rationale. Owner: independent reviewer.
  Evidence: reference section workqueue output.
- [ ] AC-2: Suitable reference sections are linked as remediation, extension, enrichment, or supporting citation with graph/LearningGoal metadata. Owner: independent reviewer.
  Evidence: ResourceNode and coverage output.
- [ ] AC-3: Unsuitable reference sections do not remain unexplained resource gaps. Owner: independent reviewer.
  Evidence: helper disposition output.

## Tasks

- [ ] Task 1: Generate reference section worklist.
  Covers: AC-1
  Acceptance: Worklist targets reference and encyclopedia sections not covered by core textbook review.
  Evidence: helper output.
  Reviewer Check: Confirm core textbook records are excluded.
- [ ] Task 2: Review reference roles item by item.
  Covers: AC-1, AC-2
  Acceptance: Accepted references include role, graph fit, and source authority rationale.
  Evidence: source diff and helper output.
  Reviewer Check: Confirm advanced/enrichment role is not confused with required path coverage.
- [ ] Task 3: Validate exclusions and limitations.
  Covers: AC-3
  Acceptance: Rejected or unsuitable sections have reviewed rationale and no unexplained gaps remain for this batch.
  Evidence: helper disposition output.
  Reviewer Check: Confirm copyright or scope limitations are visible.

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
