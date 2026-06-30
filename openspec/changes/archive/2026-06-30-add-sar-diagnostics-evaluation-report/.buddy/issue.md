---
change_id: add-sar-diagnostics-evaluation-report
claim_branch: add-sar-diagnostics-evaluation-report
series: structured-associative-retrieval
coupling_group: structured-associative-retrieval
execution_mode: stacked
base_branch: integration
required_branch:
depends_on:
  - implement-sar-association-expansion-provider
  - wire-sar-to-konling-grounding
  - wire-sar-to-graph-center-resource-gaps
  - extend-path-planner-with-sar-candidates
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/add-sar-diagnostics-evaluation-report
risk: medium
area: ai
---

## Goal

Provide SAR diagnostics, trace serialization, evaluation metrics, and a control-correction demo fixture for governance and competition demonstration.

## Scope

- Add SAR diagnostic metric builders.
- Add admin-facing report route or payload.
- Add deterministic multi-hop demo fixture.
- Compare SAR-assisted retrieval handoff with ordinary Source Pack retrieval samples.
- Protect private evidence in trace export.

## Out of Scope

- Production SAR database persistence.
- Full analytics dashboard redesign.
- New model-based reranking.
- Implementing missing upstream SAR consumers.

## Acceptance Checklist

- [ ] AC-1: SAR diagnostics report event/entity/relation counts, source/privacy distribution, query trace summaries, and limitation counts. Owner: independent reviewer.
  Evidence: metric tests.
- [ ] AC-2: Trace serialization omits private raw evidence and hidden internals. Owner: independent reviewer.
  Evidence: privacy tests.
- [ ] AC-3: Control-correction demo fixture demonstrates multi-hop SAR and Source Pack/citation handoff. Owner: independent reviewer.
  Evidence: fixture query test.
- [ ] AC-4: Admin data governance exposes SAR diagnostics or report payload. Owner: independent reviewer.
  Evidence: route/payload tests.

## Tasks

- [ ] Task 1: Add SAR diagnostics metric builders.
  Covers: AC-1
  Acceptance: counts and limitation metrics are deterministic.
  Evidence: unit tests.
  Reviewer Check: confirm metrics match projected SAR data.
- [ ] Task 2: Add trace serialization and redaction tests.
  Covers: AC-2
  Acceptance: serialized trace omits private raw evidence and hidden internals.
  Evidence: privacy tests.
  Reviewer Check: confirm admin diagnostics are governance-safe.
- [ ] Task 3: Add control-correction demo fixture.
  Covers: AC-3
  Acceptance: fixture demonstrates LearningGoal, graph nodes, resources, learner limitations, simulation/Arena, and citation handoff.
  Evidence: fixture test.
  Reviewer Check: confirm demo is deterministic and not model-dependent.
- [ ] Task 4: Add admin report route or payload.
  Covers: AC-4
  Acceptance: admin surface can inspect SAR diagnostics.
  Evidence: route/payload tests.
  Reviewer Check: confirm no student-visible route exposes admin diagnostics.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
