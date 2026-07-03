---
change_id: complete-longform-resource-path-readiness
claim_branch: complete-longform-resource-path-readiness
series: resource-path-readiness
coupling_group: resource-path-readiness-2026-07
execution_mode: stacked
base_branch: integration
required_branch:
depends_on:
  - define-resource-path-disposition-governance
  - complete-core-teaching-resource-path-readiness
parent_issue:
blocked_by:
  - define-resource-path-disposition-governance
  - complete-core-teaching-resource-path-readiness
blocking:
  - enforce-all-resource-path-readiness-gate
openspec_path: openspec/changes/complete-longform-resource-path-readiness
risk: high
area: resource-governance
---

## Goal

Make all helper-discovered textbook and reference resources effectively usable by path planning at reviewed section/exercise grain or accounted for as supporting, embedded, evidence, or excluded resources while preserving chunk-level citation support.

## Scope

- Complete path disposition and semantic metadata for all helper-discovered textbook/reference containers, sections, chunks, figures, descriptions, transcripts, slides, media anchors, and exercises.
- Promote only reviewed section-level or exercise-level resources to PlanningUnits.
- Keep chunk-level RAG and citation behavior separate from PathNode promotion.

## Out of Scope

- Auto-promoting all chunks to PathNodes.
- Completing core teaching resources already covered by the upstream issue.
- Creating learner fixture data.

## Acceptance Checklist

- [ ] AC-1: All helper-discovered in-scope long-form resources have reviewed dispositions at container, section, chunk, figure, transcript, slide/media, and exercise grain. Owner: independent reviewer.
  Evidence: helper output and metadata diff showing family/grain denominators, unaccounted counts, invalid promotion counts, unreviewed semantic counts, and no unexplained long-form resources.
- [ ] AC-2: Reviewed textbook/reference sections can be selected by the planner as path resources. Owner: independent reviewer.
  Evidence: targeted path generation test or diagnostic run.
- [ ] AC-3: Chunk, figure, and transcript citations remain deep-linkable without being treated as PathNodes. Owner: independent reviewer.
  Evidence: RAG/citation resolver test showing server-owned CitationAddress payloads.
- [ ] AC-4: Excluded or unsuitable long-form resources have rationale rather than silent omission. Owner: independent reviewer.
  Evidence: helper finding/report showing reviewed exclusion state.

## Tasks

- [ ] Task 1: Inventory all long-form resources with the helper.
  Covers: AC-1, AC-4
  Acceptance: All helper-discovered containers, sections, chunks, figures, transcripts, descriptions, slides/media anchors, and exercises are separated by source family, grain, and disposition need.
  Evidence: before helper report.
  Reviewer Check: Confirm the batch does not hide chunk-level resources by only counting books.
- [ ] Task 2: Manually complete section-level planning metadata.
  Covers: AC-1, AC-2
  Acceptance: Reviewed sections have graph, LearningGoal, prerequisite, path-role, route/citation, authority, source hash, and review metadata.
  Evidence: metadata/projection changes and after helper report with family/grain denominators and remaining blocker counts.
  Reviewer Check: Confirm SAR/RAG suggestions were reviewed before acceptance.
- [ ] Task 3: Validate citation support and non-promotion of chunks.
  Covers: AC-3
  Acceptance: Chunks remain citation support unless separately audited as PathNodes.
  Evidence: citation resolver/RAG tests.
  Reviewer Check: Confirm no raw chunk is promoted because it ranked highly in retrieval.
- [ ] Task 4: Validate OpenSpec and path checks.
  Covers: AC-1, AC-2, AC-3, AC-4
  Acceptance: OpenSpec validation, helper, and targeted path/RAG checks pass.
  Evidence: `rtk openspec validate complete-longform-resource-path-readiness --strict`.
  Reviewer Check: Confirm downstream all-resource gate remains blocked until evidence-lineage and planner gates are complete.

## Agent Guardrails

- Start by running the data-completeness helper.
- Do semantic review manually; do not script-fill knowledge, capability, LearningGoal, or prerequisite fields.
- Use SAR/RAG only to discover candidate relations and citations.
- Preserve server-owned citation addresses.
- Do not execute other planned OpenSpec changes.
