---
change_id: schedule-sar-projection-refresh-and-health
claim_branch: schedule-sar-projection-refresh-and-health
series: structured-associative-retrieval
coupling_group: structured-associative-retrieval
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - persist-sar-retrieval-index-and-query-traces
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/schedule-sar-projection-refresh-and-health
risk: high
area: data-governance
---

## Goal

Add a governed SAR projection refresh and health workflow so the persisted SAR index stays current and administrator-visible.

## Scope

- Define SAR refresh source families, source versions, stale states, failures, retries, and limitations.
- Refresh persisted SAR records through existing projection builders.
- Surface refresh health to administrator governance surfaces.

## Out of Scope

- Building a large vector service or importing external SAG infrastructure.
- Teacher K/A/Q evidence trace UI.
- Resource suggested binding review workflow.
- Live competition evaluation report.

## Acceptance Checklist

- [ ] AC-1: SAR refresh reads governed platform sources and writes through persisted SAR records idempotently. Owner: independent reviewer.
  Evidence: refresh service tests and persisted record assertions.
- [ ] AC-2: SAR refresh health records freshness, stale sources, failures, retries, and limitation codes. Owner: independent reviewer.
  Evidence: stale/failure/retry tests.
- [ ] AC-3: Administrator governance surfaces expose SAR refresh health without restricted raw content. Owner: independent reviewer.
  Evidence: admin API/UI tests and forbidden-string scan.
- [ ] AC-4: OpenSpec and targeted tests pass. Owner: independent reviewer.
  Evidence: `rtk openspec validate schedule-sar-projection-refresh-and-health --strict` and targeted test output.
- [ ] AC-5: SAR refresh preserves Arena official evaluation source authority. Owner: independent reviewer.
  Evidence: tests proving official score, validity, ranking, attempt policy, and evaluation metrics come from ArenaSubmission or official evaluation run records, while LearningFact/SAR/KAQ writeback are auxiliary evidence only.

## Tasks

- [ ] Task 1: Define the SAR refresh health contract.
  Covers: AC-2
  Acceptance: Health records include source family, high-water mark or version, last attempt, last success, stale count, failure count, retry state, and limitations.
  Evidence: Contract diff and health model tests.
  Reviewer Check: Confirm health states are actionable and not decorative metrics.
- [ ] Task 2: Implement refresh orchestration over persisted SAR records.
  Covers: AC-1
  Acceptance: Refresh reuses existing projection builders and persisted upsert semantics.
  Evidence: Refresh service tests with repeated runs.
  Reviewer Check: Confirm refresh does not fork SAR projection logic or duplicate records.
- [ ] Task 3: Expose administrator refresh health.
  Covers: AC-3
  Acceptance: Admin governance payload or UI reports fresh/stale/degraded/failed SAR refresh states.
  Evidence: Admin route/UI tests and forbidden-string scan.
  Reviewer Check: Confirm raw learner answers, hidden Arena internals, private memory, and audit traces are absent.
- [ ] Task 4: Preserve Arena official evaluation source boundaries.
  Covers: AC-5
  Acceptance: SAR refresh never derives official Arena score, validity, ranking, attempt policy, or evaluation metrics from LearningFact, SAR trace, KAQ writeback, or learner evidence projections.
  Evidence: Arena source authority tests.
  Reviewer Check: Confirm Arena official result truth remains tied to ArenaSubmission or official evaluation run records.
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
