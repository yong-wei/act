---
change_id: wire-sar-to-graph-center-resource-gaps
claim_branch: wire-sar-to-graph-center-resource-gaps
series: structured-associative-retrieval
coupling_group: structured-associative-retrieval
execution_mode: stacked
base_branch: integration
required_branch:
depends_on:
  - implement-sar-association-expansion-provider
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/wire-sar-to-graph-center-resource-gaps
risk: high
area: ai
---

## Goal

Expose SAR-associated evidence and resource gap suggestions in Graph Center without automatically changing graph bindings or ResourceNode governance state.

## Scope

- Add associated evidence payload for selected Graph Center nodes.
- Add SAR-backed resource gap candidate suggestions.
- Keep candidates separate from linked/path-eligible/citation-ready/verified counts.
- Enforce role visibility.

## Out of Scope

- Resource governance approval UI.
- Automatic graph binding updates.
- Path planner selection.
- Konling grounding.

## Acceptance Checklist

- [ ] AC-1: Selected Graph Center nodes can expose SAR associated evidence with trace summary. Owner: independent reviewer.
  Evidence: Graph Center payload tests.
- [ ] AC-2: Resource gap candidates are shown as draft/suggested and excluded from official coverage counts. Owner: independent reviewer.
  Evidence: coverage tests.
- [ ] AC-3: Student, teacher, and admin visibility rules are enforced. Owner: independent reviewer.
  Evidence: role payload tests.
- [ ] AC-4: Teacher/admin rationale explains why a candidate was suggested. Owner: independent reviewer.
  Evidence: UI or payload tests.

## Tasks

- [ ] Task 1: Add associated retrieval fields to selected node detail.
  Covers: AC-1
  Acceptance: payload includes safe event summary, trace summary, candidate refs, and limitations.
  Evidence: payload tests.
  Reviewer Check: confirm no raw source content is copied.
- [ ] Task 2: Add SAR-backed resource gap suggestions.
  Covers: AC-2
  Acceptance: candidates are separately marked and not counted as linked/path/citation coverage.
  Evidence: coverage tests.
  Reviewer Check: confirm ResourceNode audit remains authoritative.
- [ ] Task 3: Add role visibility filtering.
  Covers: AC-3
  Acceptance: student payload omits teacher/admin/audit details; teacher/admin scopes are respected.
  Evidence: role tests.
  Reviewer Check: confirm scoped evidence is not leaked.
- [ ] Task 4: Add rationale/trace display contract.
  Covers: AC-4
  Acceptance: teacher/admin payload explains association basis.
  Evidence: payload or UI tests.
  Reviewer Check: confirm rationale is trace-backed, not model-only prose.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
