---
change_id: produce-sar-live-evaluation-report
claim_branch: produce-sar-live-evaluation-report
series: structured-associative-retrieval
coupling_group: structured-associative-retrieval
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - persist-sar-retrieval-index-and-query-traces
  - schedule-sar-projection-refresh-and-health
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/produce-sar-live-evaluation-report
risk: medium
area: data-governance
---

## Goal

Produce a governed SAR live evaluation report that moves beyond the deterministic demo fixture into comparable, privacy-safe evidence for product and competition review.

## Scope

- Generate a SAR evaluation report from persisted traces and diagnostics.
- Compare SAR-assisted retrieval against ordinary retrieval baseline behavior.
- Include metrics, limitations, and at least two target-user feedback or structured test records.

## Out of Scope

- New retrieval algorithms.
- Source Pack ranking changes.
- Citation verifier replacement.
- Teacher trace UI or suggested binding workflow.

## Acceptance Checklist

- [ ] AC-1: SAR live evaluation report includes representative queries, baseline comparison, metrics, limitations, and feedback/test records. Owner: independent reviewer.
  Evidence: report artifact, payload, or UI test.
- [ ] AC-2: Report metrics distinguish SAR candidates from verified citations and ordinary retrieval baseline results. Owner: independent reviewer.
  Evidence: metric calculation tests.
- [ ] AC-3: Report rendering/export excludes restricted raw content. Owner: independent reviewer.
  Evidence: forbidden-string privacy tests.
- [ ] AC-4: OpenSpec and targeted tests pass. Owner: independent reviewer.
  Evidence: `rtk openspec validate produce-sar-live-evaluation-report --strict` and targeted test output.
- [ ] AC-5: Arena official metrics in the report preserve source authority. Owner: independent reviewer.
  Evidence: tests proving score, validity, ranking, attempt policy, and evaluation metrics come from ArenaSubmission or official evaluation run records, while LearningFact/SAR/KAQ writeback are auxiliary learning evidence only.

## Tasks

- [ ] Task 1: Define the live evaluation report contract.
  Covers: AC-1, AC-2
  Acceptance: Contract covers queries, baseline comparison, SAR candidate refs, verified citation outcomes, metrics, feedback/test records, and limitations.
  Evidence: Contract diff and metric tests.
  Reviewer Check: Confirm the report is evaluation evidence, not another demo-only fixture.
- [ ] Task 2: Implement report generation from persisted traces and diagnostics.
  Covers: AC-1, AC-2, AC-5
  Acceptance: Report uses persisted SAR traces and ordinary retrieval baseline data where available.
  Evidence: Report generation tests.
  Reviewer Check: Confirm candidates and verified citations remain visually/data-wise distinct, and official Arena metrics are sourced only from official Arena records.
- [ ] Task 3: Add privacy-safe render/export coverage.
  Covers: AC-3
  Acceptance: Displayed/exported report omits raw learner answers, hidden Arena internals, private memory, and raw audit traces.
  Evidence: Forbidden-string tests.
  Reviewer Check: Confirm tests inspect final report output.
- [ ] Task 4: Add Arena source-authority tests.
  Covers: AC-5
  Acceptance: Report labels LearningFact, SAR trace, KAQ writeback, and learner evidence projections as auxiliary learning evidence context, not official Arena outcomes.
  Evidence: Arena metric source tests.
  Reviewer Check: Confirm official Arena truth is not inferred from learning evidence projections.
- [ ] Task 5: Run validation and record evidence.
  Covers: AC-4
  Acceptance: OpenSpec strict validation and targeted tests pass.
  Evidence: Validation command output and test output.
  Reviewer Check: Confirm failures are fixed or explicitly unrelated.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
