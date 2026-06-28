---
change_id: define-structured-associative-retrieval-contract
claim_branch: define-structured-associative-retrieval-contract
series: structured-associative-retrieval
coupling_group: structured-associative-retrieval
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/define-structured-associative-retrieval-contract
risk: high
area: ai
---

## Goal

Define the governed SAR event/entity/relation/trace contract that later changes can consume without creating a parallel RAG, graph, or path-planning system.

## Scope

- Add SAR contracts for events, entities, event-entity relations, traces, and results.
- Require stable platform identifiers and safe summaries.
- Enforce privacy, authority, freshness, source ownership, and confidence validation.
- State that citation verification remains outside SAR.

## Out of Scope

- Projection from real platform sources.
- Query-time association expansion.
- Konling, Graph Center, path planner, or admin UI integration.
- Prisma persistence or background indexing.

## Acceptance Checklist

- [ ] AC-1: SAR contracts cover event, entity, relation, trace, and result shapes. Owner: independent reviewer.
  Evidence: type definitions and contract tests.
- [ ] AC-2: Contract validation rejects missing source refs, missing canonical refs, invalid confidence, restricted raw content, hidden evaluation internals, private Konling memory, raw learner submissions, and audit-only traces. Owner: independent reviewer.
  Evidence: unit tests for invalid fixtures.
- [ ] AC-3: The contract explicitly keeps final citation verification and CitationChip construction outside SAR. Owner: independent reviewer.
  Evidence: spec/design review and tests or type boundaries showing SAR returns candidates/limitations only.

## Tasks

- [ ] Task 1: Define SAR type contracts and result shapes.
  Covers: AC-1
  Acceptance: event, entity, relation, trace, and result types compile and match the OpenSpec contract.
  Evidence: type tests or targeted unit tests.
  Reviewer Check: confirm the contract does not duplicate Source Pack or CitationChip payload ownership.
- [ ] Task 2: Add validation helpers and invalid fixture tests.
  Covers: AC-2
  Acceptance: invalid source refs, canonical refs, confidence, restricted raw content, hidden evaluation internals, private Konling memory, raw learner submissions, and audit-only traces are rejected.
  Evidence: unit tests.
  Reviewer Check: confirm privacy and confidence checks are fail-closed.
- [ ] Task 3: Document the SAR citation boundary.
  Covers: AC-3
  Acceptance: design/spec or code comments state that SAR cannot mark citations as verified.
  Evidence: spec validation and reviewer inspection.
  Reviewer Check: confirm downstream consumers must use Source Pack/LearningEvidence citation verification.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
