---
change_id: complete-rag-citation-anchor-coverage
claim_branch: complete-rag-citation-anchor-coverage
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
parent_issue: 786
blocked_by:
  - review-runtime-lesson-planning-units
  - review-runtime-media-handout-dispositions
  - review-core-textbook-section-path-roles
  - review-reference-section-path-roles
blocking:
  - close-resource-disposition-review-backlog
  - complete-resource-evidence-lineage-readiness
  - enforce-all-resource-path-readiness-gate
openspec_path: openspec/changes/complete-rag-citation-anchor-coverage
risk: high
area: ai
---

## Goal

Close RAG indexing and citation-anchor gaps for reviewed resource projections without promoting citation-only chunks into path nodes.

## Scope

- Index reviewed textbook/reference sections, related chunks, figures, and anchors through governed corpus metadata.
- Complete or explicitly limit media transcript, slide, image, figure, page, equation, and timestamp anchors.
- Verify CitationAddress resolution for selected/supporting path resources and Konling grounding.

## Out of Scope

- Do not alter model prompts as a substitute for citation metadata.
- Do not make raw chunks path-plannable.

## Acceptance Checklist

- [x] AC-1: Reviewed long-form and media projections have mapped retrieval chunks or reviewed limitation states. Owner: independent reviewer.
  Evidence: RAG/citation helper output.
- [x] AC-2: CitationAddress metadata resolves display hrefs from server-owned metadata for reviewed path/supporting resources. Owner: independent reviewer.
  Evidence: citation resolver tests.
- [x] AC-3: Unresolved transcript/anchor gaps are reduced or explicitly classified by media/source family. Owner: independent reviewer.
  Evidence: citation readiness output.

## Tasks

- [x] Task 1: Generate citation/index worklist.
  Covers: AC-1, AC-3
  Acceptance: Worklist separates unmapped chunks, missing anchors, missing transcripts, and resolver limitations.
  Evidence: helper output.
  Reviewer Check: Confirm path eligibility is not inferred from indexability.
- [x] Task 2: Complete governed index and anchor metadata.
  Covers: AC-1, AC-2, AC-3
  Acceptance: Reviewed sources resolve through server-owned CitationAddress metadata or limitation state.
  Evidence: source diff and resolver tests.
  Reviewer Check: Confirm model-authored URLs are not trusted.
- [x] Task 3: Validate Konling/path citation coverage.
  Covers: AC-2
  Acceptance: Selected/supporting resources can be cited with clickable or limited citation chips.
  Evidence: targeted citation tests.
  Reviewer Check: Confirm privacy and authority scope are respected.

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
