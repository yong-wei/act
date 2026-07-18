---
change_id: complete-longform-textbook-reference-resource-semantics
claim_branch: complete-longform-textbook-reference-resource-semantics
series: resource-semantic-completion-closure
coupling_group: resource-semantic-data
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue: 876
blocked_by: []
blocking: []
openspec_path: openspec/changes/complete-longform-textbook-reference-resource-semantics
risk: high
area: resource-governance
---

## Goal

Complete reviewed semantics for textbook and reference resources at the correct section/supporting-resource grain so they can support path planning and clickable RAG/Konling citations without promoting raw chunks into paths.

## Scope

- Process textbook/reference sections, search documents, chunks, figures, captions, image descriptions, equations, tables, and citation targets.
- Review section-level resources for path eligibility, graph/K/A/Q fit, LearningGoal fit, prerequisite position, authority, privacy, and source/version state.
- Link non-section items to parent sections or classify them with reviewed support/exclusion rationale.
- Validate citation addressability.

## Out of Scope

- Runtime lesson media and handouts.
- Assessment item/checkpoint semantics.
- Vector database or embedding implementation.
- Bulk script-generated semantic completion.

## Acceptance Checklist

- [x] AC-1: Scoped long-form workqueues are deterministic and include only textbook/reference long-form families with starting blocker counts. Owner: independent reviewer.
  Evidence: helper output.
- [x] AC-2: Path-plannable sections have reviewed section-level ResourceNode semantics. Owner: independent reviewer.
  Evidence: metadata diff and ResourceNode audit.
- [x] AC-3: Chunks, search documents, figures, captions, and similar child items are parent-linked or classified with reviewed rationale and cannot become PathNodes by retrieval relevance alone. Owner: independent reviewer.
  Evidence: parent-link checks and helper before/after output.
- [x] AC-4: Scoped long-form queues close with `remaining: 0` for unexplained unreviewed long-form items, and supporting citations resolve through section, figure, page, or anchor metadata, or carry reviewed limitation state. Owner: independent reviewer.
  Evidence: final scoped helper summary plus citation resolver/RAG focused checks.
- [x] AC-5: OpenSpec and Buddy contracts remain valid. Owner: independent reviewer.
  Evidence: `rtk openspec validate complete-longform-textbook-reference-resource-semantics --strict` and issue-body validation pass.

## Tasks

- [x] Task 1: Generate scoped long-form workqueues.
  Covers: AC-1
  Acceptance: Queue is limited to textbook/reference long-form families and records starting blockers.
  Evidence: Helper output.
  Reviewer Check: Confirm runtime and assessment families are excluded.
- [x] Task 2: Review section-level PlanningUnits.
  Covers: AC-2
  Acceptance: Path-plannable sections have reviewed source, graph/K/A/Q, LearningGoal, path, citation, privacy, authority, source hash, and review metadata.
  Evidence: Metadata diff and ResourceNode audit.
  Reviewer Check: Confirm reviewed sections are suitable as student path resources.
- [x] Task 3: Review child item support roles.
  Covers: AC-3
  Acceptance: Child items are parent-linked or classified with reviewed rationale and cannot become PathNodes.
  Evidence: Parent-link checks and helper output.
  Reviewer Check: Confirm raw search documents are not promoted by relevance alone.
- [x] Task 4: Validate citation addressability.
  Covers: AC-4
  Acceptance: Scoped helper output reports `remaining: 0` for unexplained unreviewed long-form items, and supporting citations resolve or carry reviewed limitation state.
  Evidence: Final helper summary plus citation resolver and RAG checks.
  Reviewer Check: Confirm citation links are usable where source anchors exist and no item was skipped because semantic review was required.
- [x] Task 5: Run validation and prepare review evidence.
  Covers: AC-5
  Acceptance: OpenSpec validation, issue-body validation, helper checks, and focused tests pass.
  Evidence: Command output.
  Reviewer Check: Confirm all AC ids have evidence and no AC is self-approved.

## Agent Guardrails

- Only execute this issue's change.
- Semantic review is an implementing-agent responsibility in this issue; do not mark `needs-human` merely because semantic judgment is required.
- Use helper scripts only for workqueue selection, gap measurement, parent-link inspection, and validation. Do not use scripts to infer accepted semantic labels.
- Raw chunks/search documents are not path nodes unless a separate reviewed PlanningUnit is created.
- This issue must not block Yang Fan fixture data completion; fixture readiness remains scoped to fixture-owned governed resources.
- Stop only for concrete blockers: missing scoped workqueue, unstable denominator, inaccessible source artifact, schema conflict, dependency conflict, claim conflict, or PR/branch conflict.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
