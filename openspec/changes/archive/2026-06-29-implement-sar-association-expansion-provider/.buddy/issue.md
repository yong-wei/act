---
change_id: implement-sar-association-expansion-provider
claim_branch: implement-sar-association-expansion-provider
series: structured-associative-retrieval
coupling_group: structured-associative-retrieval
execution_mode: stacked
base_branch: integration
required_branch:
depends_on:
  - project-platform-sources-to-sar-events
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/implement-sar-association-expansion-provider
risk: high
area: ai
---

## Goal

Implement bounded SAR association expansion that returns governed candidate refs and trace without duplicating Source Pack hybrid retrieval, ranking, or citation hydration.

## Scope

- Resolve seed refs into SAR entities.
- Support 0/1/2-hop event/entity expansion.
- Enforce role/student/class/privacy filters.
- Return trace, selected/rejected refs, limitations, and Source Pack seed refs.

## Out of Scope

- Full hybrid retrieval and ranking.
- Citation verification and CitationChip construction.
- Konling, Graph Center, path planner, or admin UI integration.
- Persistence or async indexing.

## Acceptance Checklist

- [ ] AC-1: SAR supports deterministic 0-hop, 1-hop, and 2-hop association expansion. Owner: independent reviewer.
  Evidence: expansion service tests.
- [ ] AC-2: Caller scope filtering rejects or redacts inaccessible events before candidate output. Owner: independent reviewer.
  Evidence: privacy and rejected-ref tests.
- [ ] AC-3: SAR returns candidate refs for Source Pack/consumers but does not perform Source Pack ranking or citation hydration. Owner: independent reviewer.
  Evidence: contract tests and code review.
- [ ] AC-4: Multi-hop fixture covers Bode margin to controller correction to simulation/Arena association. Owner: independent reviewer.
  Evidence: deterministic fixture test.

## Tasks

- [ ] Task 1: Implement expansion input/output and trace.
  Covers: AC-1
  Acceptance: 0/1/2-hop modes return bounded event/entity paths.
  Evidence: service tests.
  Reviewer Check: confirm hop trace is deterministic and bounded.
- [ ] Task 2: Implement scoped filtering and rejected reasons.
  Covers: AC-2
  Acceptance: student, teacher, admin, class, and audit-only cases are filtered correctly.
  Evidence: privacy tests.
  Reviewer Check: confirm rejected refs do not leak private content.
- [ ] Task 3: Return candidate refs instead of final citation packs.
  Covers: AC-3
  Acceptance: output exposes refs and limitations, not hydrated CitationChip payloads.
  Evidence: contract tests.
  Reviewer Check: confirm Source Pack remains the ranking/citation owner.
- [ ] Task 4: Add multi-hop teaching fixture.
  Covers: AC-4
  Acceptance: fixture demonstrates frequency-response margin, controller correction, simulation validation, and Arena official evidence association.
  Evidence: unit test.
  Reviewer Check: confirm fixture uses platform-style stable refs.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
