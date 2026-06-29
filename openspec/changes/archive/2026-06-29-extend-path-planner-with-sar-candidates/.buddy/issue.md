---
change_id: extend-path-planner-with-sar-candidates
claim_branch: extend-path-planner-with-sar-candidates
series: structured-associative-retrieval
coupling_group: structured-associative-retrieval
execution_mode: stacked
base_branch: integration
required_branch:
depends_on:
  - implement-sar-association-expansion-provider
  - integrate-source-pack-consumers
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/extend-path-planner-with-sar-candidates
risk: high
area: ai
---

## Goal

Allow adaptive path planning to use SAR-associated candidates as supplemental evidence without bypassing LearningGoal, K/A/Q, ResourceNode, PlanningUnit, readiness, privacy, teacher policy, or terminal validation gates.

## Scope

- Add optional SAR candidate input to planner contracts.
- Map SAR refs to existing ResourceNode/PlanningUnit candidates.
- Reject ineligible candidates with reasons.
- Add SAR adoption/rejection explanation metadata.
- Preserve stable fallback when SAR is disabled.

## Out of Scope

- Implementing SAR core expansion.
- Changing LearningGoal semantics.
- Allowing retrieval chunks or citation targets to become PathNodes.
- Graph Center or Konling integration.

## Acceptance Checklist

- [ ] AC-1: SAR candidates can enter planner evaluation only through audited ResourceNode/PlanningUnit mapping. Owner: independent reviewer.
  Evidence: planner tests.
- [ ] AC-2: Ineligible, private, teacher-blocked, readiness-blocked, or terminal-validation-insufficient SAR candidates are rejected with reasons. Owner: independent reviewer.
  Evidence: rejection tests.
- [ ] AC-3: Path explanations show SAR candidate adoption and rejection. Owner: independent reviewer.
  Evidence: payload tests.
- [ ] AC-4: Planner output remains stable when SAR is disabled or unavailable. Owner: independent reviewer.
  Evidence: fallback tests.

## Tasks

- [ ] Task 1: Add optional SAR candidate input and registry mapping.
  Covers: AC-1
  Acceptance: candidates resolve only through existing ResourceNode/PlanningUnit data.
  Evidence: planner tests.
  Reviewer Check: confirm RetrievalChunk/CitationTarget cannot become PathNode directly.
- [ ] Task 2: Apply eligibility, privacy, policy, readiness, and terminal validation gates.
  Covers: AC-2
  Acceptance: blocked candidates are rejected with structured reasons.
  Evidence: rejection tests.
  Reviewer Check: confirm no dynamic association overrides hard planner gates.
- [ ] Task 3: Add associative retrieval basis to path explanation.
  Covers: AC-3
  Acceptance: payload records seed entities, candidate ids, selected ids, rejected ids, and reasons.
  Evidence: payload tests.
  Reviewer Check: confirm explanation is trace-backed.
- [ ] Task 4: Add SAR disabled fallback tests.
  Covers: AC-4
  Acceptance: planner produces valid path without SAR.
  Evidence: fallback tests.
  Reviewer Check: confirm SAR is optional enhancement, not hard dependency.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
