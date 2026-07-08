---
change_id: govern-konling-answer-citation-relevance
claim_branch: govern-konling-answer-citation-relevance
series: konling-citation-personalization
coupling_group: konling-citation-personalization
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/govern-konling-answer-citation-relevance
risk: medium
area: ai
---

## Goal

Prevent Konling knowledge graph answers from citing unrelated textbook chunks as high-confidence evidence. The implementation must make answer citation relevance a runtime contract, not a UI preference.

## Scope

- Add `konling-answer` Source Pack relevance gating for current question, selected knowledge node, capability target, resource ref, SAR candidate, learner context, or accepted semantic score.
- Record answer-relevance audit evidence for selected citations, including basis and bounded match evidence.
- Propagate no-relevant-citation reasons into Konling citation metadata without exposing raw diagnostics to students.
- Add regression tests for the known `ADVANCED PROBLEMS` leakage chunks, including `ch01-advanced-problems-031__chunk-001`.
- Keep the behavior specific to answer grounding; authoring, assessment, lesson-design, and path-planning profiles must retain their current retrieval semantics unless explicitly covered by tests.

## Out of Scope

- Large-scale textbook search-document review or semantic field completion.
- Knowledge graph visual or citation-chip UI redesign.
- Model-provider citation normalization.
- Database migrations or external vector/reranker services.

## Acceptance Checklist

- [ ] AC-1: `konling-answer` retrieval rejects high-authority citation-ready items that have no sufficient answer relevance and records auditable relevance evidence for selected items. Owner: independent reviewer.
  Evidence: focused Source Pack unit tests and implementation diff showing relevance gate, relevance audit, and limitations.
- [ ] AC-2: Konling runtime does not pass unrelated Source Pack items into answer generation, citation verification, or student-visible high-confidence content citations when answering from `/knowledge`. Owner: independent reviewer.
  Evidence: focused Konling runtime tests covering selected-node, no-relevant-citation, and privacy-safe student text cases.
- [ ] AC-3: Regression coverage prevents `ch01-advanced-problems-031__chunk-001` and adjacent `ADVANCED PROBLEMS` rows from becoming default citations for unrelated prompts. Owner: independent reviewer.
  Evidence: deterministic fixture or runtime-backed test asserting excluded citation ids.
- [ ] AC-4: OpenSpec and Buddy contracts remain valid. Owner: independent reviewer.
  Evidence: `openspec validate govern-konling-answer-citation-relevance --strict` and issue-body validation pass.
- [ ] AC-5: Non-`konling-answer` Source Pack profiles retain their existing retrieval semantics. Owner: independent reviewer.
  Evidence: focused Source Pack regression test for at least one non-answer profile.

## Tasks

- [ ] Task 1: Implement Source Pack answer-relevance gate for `konling-answer`.
  Covers: AC-1
  Acceptance: Candidate selection requires relevance through query, graph, objective, resource, SAR/learner, or semantic signals; authority alone cannot select the item.
  Evidence: Source Pack retrieval tests and diff in `src/lib/source-pack/*`.
  Reviewer Check: Confirm non-answer profiles are not unintentionally narrowed.
- [ ] Task 2: Add Source Pack answer-relevance audit evidence for selected or rejected answer citations.
  Covers: AC-1
  Acceptance: Selected `konling-answer` citations expose bounded relevance basis and match evidence; rejected items expose a stable insufficient-relevance reason.
  Evidence: Source Pack retrieval tests and diff in `src/lib/source-pack/*`.
  Reviewer Check: Confirm tests can explain why a selected citation is relevant without exposing private learner data.
- [ ] Task 3: Add Source Pack limitation reporting for missing answer relevance.
  Covers: AC-1, AC-4
  Acceptance: No relevant content produces auditable limitation codes rather than silent fallback.
  Evidence: Source Pack unit tests and strict OpenSpec validation.
  Reviewer Check: Confirm limitation codes are stable enough for tests and downstream metadata.
- [ ] Task 4: Integrate relevance outcomes into Konling citation context.
  Covers: AC-2
  Acceptance: Konling omits irrelevant content citations from answer generation, citation verification, and student-visible high-confidence citation chips, while carrying safe missing-citation reasons in runtime metadata.
  Evidence: Konling runtime tests and diff in `src/lib/konling-agent-runtime.ts`.
  Reviewer Check: Confirm student-visible output does not expose privileged internal diagnostics.
- [ ] Task 5: Add regression tests for the known knowledge graph citation leakage chunks.
  Covers: AC-2, AC-3
  Acceptance: Tests explicitly include `ch01-advanced-problems-031__chunk-001` or equivalent sibling rows and assert they do not appear for unrelated prompts.
  Evidence: focused test output.
  Reviewer Check: Confirm the tests would fail against the current leakage behavior.
- [ ] Task 6: Add non-answer profile regression coverage.
  Covers: AC-5
  Acceptance: At least one focused Source Pack test proves the new answer relevance gate does not alter authoring, assessment, lesson-design, or path-planning retrieval semantics.
  Evidence: focused test output.
  Reviewer Check: Confirm the gate is scoped to `konling-answer`.
- [ ] Task 7: Run validation and prepare review evidence.
  Covers: AC-4, AC-5
  Acceptance: `rtk npm run test:unit -- src/lib/__tests__/source-pack-hybrid-retriever.test.ts src/lib/__tests__/konling-agent-runtime.test.ts`, `rtk npm run typecheck`, issue body validation, and `rtk openspec validate govern-konling-answer-citation-relevance --strict` pass or any pre-existing unrelated debt is documented.
  Evidence: command output in implementation summary.
  Reviewer Check: Confirm all evidence maps to AC ids and no AC is self-approved by the implementation thread.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
