---
change_id: project-platform-sources-to-sar-events
claim_branch: project-platform-sources-to-sar-events
series: structured-associative-retrieval
coupling_group: structured-associative-retrieval
execution_mode: stacked
base_branch: integration
required_branch:
depends_on:
  - define-structured-associative-retrieval-contract
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/project-platform-sources-to-sar-events
risk: high
area: ai
---

## Goal

Project governed ACT sources into SAR events/entities without scanning raw authoring files or duplicating Graph Center resource matching logic.

## Scope

- Project K/A/Q graph, LearningGoal, ResourceNode, LearningEvidenceCorpusChunk, and governed summary sources.
- Preserve stable refs, authority, freshness, privacy scope, citation target refs, and path eligibility signals.
- Reuse shared graph/resource coverage matching semantics.
- Protect learner and audit-only raw content through redaction and limitations.

## Out of Scope

- Query-time SAR expansion.
- Source Pack ranking or citation hydration.
- UI integration.
- Persistence or background indexing.

## Acceptance Checklist

- [ ] AC-1: Graph and LearningGoal sources project to SAR events/entities with required graph/objective/portrait bindings. Owner: independent reviewer.
  Evidence: projection tests.
- [ ] AC-2: ResourceNode, PlanningUnit, RetrievalChunk, CitationTarget, and LearningEvidence chunks project without promoting retrieval chunks into path nodes. Owner: independent reviewer.
  Evidence: resource/evidence projection tests.
- [ ] AC-3: Projection reuses or extracts Graph Center resource coverage matching semantics. Owner: independent reviewer.
  Evidence: shared helper tests or paired Graph Center/SAR matching fixtures.
- [ ] AC-4: Private learner/evaluation sources project only safe summaries or scoped refs. Owner: independent reviewer.
  Evidence: privacy redaction tests.

## Tasks

- [ ] Task 1: Add graph and LearningGoal projection builders.
  Covers: AC-1
  Acceptance: K/A/Q graph nodes and LearningGoals produce required SAR bindings.
  Evidence: unit tests.
  Reviewer Check: confirm LearningGoal and ExpandedGoalSubgraph are treated as first-class seeds.
- [ ] Task 2: Add resource and evidence projection builders.
  Covers: AC-2
  Acceptance: ResourceNode, PlanningUnit, RetrievalChunk, CitationTarget, and corpus chunk refs are preserved with eligibility separated.
  Evidence: unit tests.
  Reviewer Check: confirm RetrievalChunk/CitationTarget cannot become PathNode.
- [ ] Task 3: Share Graph Center coverage matching semantics.
  Covers: AC-3
  Acceptance: SAR and Graph Center fixtures agree on resource/evidence graph bindings.
  Evidence: shared helper or fixture tests.
  Reviewer Check: confirm no second ad hoc matching rule exists.
- [ ] Task 4: Add scoped summary and redaction tests.
  Covers: AC-4
  Acceptance: private learner/evaluation sources omit raw content and expose limitations.
  Evidence: privacy tests.
  Reviewer Check: confirm student-visible projection cannot leak teacher/admin/audit-only details.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
