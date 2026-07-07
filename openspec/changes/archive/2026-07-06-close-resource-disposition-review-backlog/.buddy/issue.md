---
change_id: close-resource-disposition-review-backlog
claim_branch: close-resource-disposition-review-backlog
series: resource-path-readiness
coupling_group: resource-path-readiness-2026-07
execution_mode: stacked
base_branch: integration
required_branch:
depends_on:
  - review-runtime-lesson-planning-units
  - review-runtime-media-handout-dispositions
  - review-core-textbook-section-path-roles
  - review-reference-section-path-roles
  - complete-learning-goal-assessment-baselines
  - complete-rag-citation-anchor-coverage
  - close-graph-resource-coverage-backlog
parent_issue: 786
blocked_by:
  - review-runtime-lesson-planning-units
  - review-runtime-media-handout-dispositions
  - review-core-textbook-section-path-roles
  - review-reference-section-path-roles
  - complete-learning-goal-assessment-baselines
  - complete-rag-citation-anchor-coverage
  - close-graph-resource-coverage-backlog
blocking:
  - complete-resource-evidence-lineage-readiness
  - enforce-all-resource-path-readiness-gate
openspec_path: openspec/changes/close-resource-disposition-review-backlog
risk: high
area: resource-governance
---

## Goal

Resolve the residual disposition backlog through implementing-agent item-by-item semantic review of remaining resources or by creating precise exclusion/limitation states.

## Scope

- Run the helper after upstream resource-family batches and isolate all remaining missing human-review, missing disposition, invalid promotion, unmatched projection, or unexplained exclusion findings.
- Review residual knowledge cards, infographs, registered resources, quiz/exercise/homework resources, slides, video/audio, image descriptions, miscellaneous runtime projections, and any cross-family leftovers.
- Produce a final before/after helper summary for downstream evidence-lineage and full-readiness gate changes.

## Out of Scope

- Do not bypass upstream family-specific reviews.
- Do not relax the final resource readiness gate.

## Acceptance Checklist

- [ ] AC-1: Residual missing human-review and missing disposition findings are resolved or intentionally limited. Owner: independent reviewer.
  Evidence: helper before/after output.
- [ ] AC-2: Every existing resource is accounted for as path-plannable, supporting-citation, embedded-asset, evidence-producing, or excluded-with-rationale. Owner: independent reviewer.
  Evidence: resource disposition helper output.
- [ ] AC-3: Downstream evidence-lineage and final-gate blockers reference only non-resource-family evidence gaps, not unreviewed resource semantics. Owner: independent reviewer.
  Evidence: helper summary.

## Tasks

- [ ] Task 1: Generate residual backlog worklist.
  Covers: AC-1
  Acceptance: Helper output isolates only leftovers after upstream batches.
  Evidence: helper output.
  Reviewer Check: Confirm upstream family queues have been completed or explicitly excluded.
- [ ] Task 2: Review residual resources item by item.
  Covers: AC-1, AC-2
  Acceptance: Every residual resource gets reviewed disposition or limitation.
  Evidence: source diff and helper output.
  Reviewer Check: Confirm no semantic field is script-filled without review.
- [ ] Task 3: Produce downstream readiness summary.
  Covers: AC-3
  Acceptance: Evidence-lineage and final-gate issues receive summarized helper evidence.
  Evidence: helper summary file or verification notes.
  Reviewer Check: Confirm remaining blockers are outside semantic resource disposition scope.

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
