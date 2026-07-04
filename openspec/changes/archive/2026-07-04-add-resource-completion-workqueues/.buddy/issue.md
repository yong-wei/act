---
change_id: add-resource-completion-workqueues
claim_branch: add-resource-completion-workqueues
series: resource-path-readiness
coupling_group: resource-path-readiness-2026-07
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue: 786
blocked_by: []
blocking:
  - complete-analysis-design-graph-resource-bindings
  - complete-foundation-graph-resource-bindings
  - repair-resource-identity-bindings
  - review-runtime-lesson-planning-units
  - review-runtime-media-handout-dispositions
openspec_path: openspec/changes/add-resource-completion-workqueues
risk: medium
area: data-governance
---

## Goal

Extend the helper output so agents can claim bounded resource-completion workqueues and verify before/after progress without scanning the entire resource universe manually.

## Scope

- Emit stable workqueue JSON/Markdown grouped by resource family, LearningGoal, graph domain, missing-field code, and suggested review batch.
- Preserve privacy-minimized output and raw-content exclusion.
- Add tests proving each queue is deterministic, deduplicated, and references stable candidate ids from existing helper output.

## Out of Scope

- Do not complete semantic fields in this change.
- Do not change planner behavior or citation resolver behavior.

## Acceptance Checklist

- [ ] AC-1: Helper emits deterministic workqueues for resource identity, graph binding, runtime lesson, media/handout, long-form, assessment, RAG/citation, residual graph coverage, residual disposition work, knowledge cards, infographs, quiz/exercise/homework, slides, video/audio, and image descriptions. Owner: independent reviewer.
  Evidence: before/after helper fixture output and snapshot tests.
- [ ] AC-2: Each workqueue item contains stable resource id, source family, current blockers, recommended reviewer action, and dependency hints without raw resource content. Owner: independent reviewer.
  Evidence: JSON schema tests and privacy checks.
- [ ] AC-3: Workqueue totals reconcile with existing helper layer totals, follow-up buckets, and current audit snapshot counts including 7 missing registryId, 36 unregistered registryId, 112 TeachingResources missing knowledge binding, missing lesson 1-3 runtime JSON, 541 graph nodes missing resource refs, 1,142 missing disposition reviews, 9 limited LearningGoals, 2,987 unmapped retrieval chunks, and 158 missing transcript or anchor targets. Owner: independent reviewer.
  Evidence: reconciliation test using current helper fixtures.

- [ ] AC-4: Human-confirmed semantic rows cannot be produced solely by script constants, generated suggestions, placeholder reviewer ids, missing rationale, or missing source version/hash. Owner: independent reviewer.
  Evidence: helper integrity test or sampled audit output.

## Tasks

- [ ] Task 1: Add workqueue output contracts.
  Covers: AC-1, AC-2
  Acceptance: The helper emits typed queues for every major resource-completion batch.
  Evidence: unit tests for generated workqueue shape.
  Reviewer Check: Confirm queue records are stable and privacy minimized.
- [ ] Task 2: Add reconciliation checks.
  Covers: AC-3
  Acceptance: Queue totals reconcile with helper totals and do not double-count resources across primary queues.
  Evidence: fixture-based reconciliation tests.
  Reviewer Check: Confirm every current uncovered blocker, including knowledge cards, infographs, quiz/exercise/homework, slides, video/audio, image descriptions, and the named audit snapshot counts, appears in exactly one primary queue or an explicit dependent queue.
- [ ] Task 3: Validate OpenSpec and helper output.
  Covers: AC-1, AC-2, AC-3
  Acceptance: OpenSpec validation and targeted helper tests pass.
  Evidence: `rtk openspec validate add-resource-completion-workqueues --strict` plus targeted helper tests.
  Reviewer Check: Confirm no semantic field is auto-promoted by this change.

- [ ] Task 4: Add human-review integrity checks.
  Covers: AC-4
  Acceptance: Helper output flags human-confirmed rows that lack reviewer identity, review time, source hash/version, reviewer-visible rationale, or separate human review evidence.
  Evidence: helper integrity tests or sampled audit output.
  Reviewer Check: Confirm legacy seed constants cannot be copied as proof of fresh human review.

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
