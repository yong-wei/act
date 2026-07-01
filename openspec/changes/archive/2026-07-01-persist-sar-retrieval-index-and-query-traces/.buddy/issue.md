---
change_id: persist-sar-retrieval-index-and-query-traces
claim_branch: persist-sar-retrieval-index-and-query-traces
series: structured-associative-retrieval
coupling_group: structured-associative-retrieval
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - expose-sar-diagnostics-admin-surface
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/persist-sar-retrieval-index-and-query-traces
risk: high
area: data-governance
---

## Goal

Persist the stabilized SAR retrieval index and query traces so SAR can support production diagnostics, refresh health, teacher evidence tracing, and later evaluation reports.

## Scope

- Add governed SAR persistence for events, entities, event-entity relations, and query traces.
- Persist only safe summaries, stable refs, privacy scope, authority, hashes, limitations, version refs, and handoff state.
- Add idempotent upsert/rebuild behavior and privacy-safe export tests.

## Out of Scope

- Source Pack ranking, final citation verification, or CitationChip construction.
- Automatic K/A/Q graph binding writeback.
- Scheduler/refresh orchestration, teacher trace UI, suggested binding review, and live evaluation reports.

## Acceptance Checklist

- [ ] AC-1: SAR events, entities, relations, and query traces have a durable persistence contract and implementation. Owner: independent reviewer.
  Evidence: Prisma/schema or persistence contract diff plus targeted persistence tests.
- [ ] AC-2: Persistence is idempotent and does not duplicate stable SAR records or relations across rebuilds. Owner: independent reviewer.
  Evidence: duplicate projection/upsert test.
- [ ] AC-3: Persisted/exported SAR records exclude raw learner answers, hidden Arena internals, private Konling memory, and raw audit traces. Owner: independent reviewer.
  Evidence: privacy redaction tests scanning persisted/exported payloads.
- [ ] AC-4: OpenSpec and targeted tests pass. Owner: independent reviewer.
  Evidence: `rtk openspec validate persist-sar-retrieval-index-and-query-traces --strict` and targeted SAR persistence/data-governance test output.
- [ ] AC-5: Persisted SAR query traces have a verifiable retention and minimization policy. Owner: independent reviewer.
  Evidence: tests for hash-only query identity, student-scoped retention window, deletion or aggregation boundary, and export exclusion.

## Tasks

- [ ] Task 1: Define and implement the persisted SAR index records.
  Covers: AC-1
  Acceptance: Event, entity, relation, and trace records preserve stable ids, source refs, authority, privacy scope, content hash, limitations, and version refs.
  Evidence: Schema/contract diff and persistence test output.
  Reviewer Check: Confirm the schema mirrors SAR contracts and does not create a second incompatible SAR model.
- [ ] Task 2: Add idempotent upsert and rebuild behavior.
  Covers: AC-2
  Acceptance: Re-projecting the same SAR ids updates records without duplicate relations or stale trace corruption.
  Evidence: Duplicate projection/upsert test.
  Reviewer Check: Confirm stable ids and relation uniqueness are enforced.
- [ ] Task 3: Add privacy-safe persistence and export tests.
  Covers: AC-3
  Acceptance: Forbidden raw fixture strings are absent from stored/exported SAR records.
  Evidence: Tests for learner answer, hidden Arena internals, private memory, and audit-only trace data.
  Reviewer Check: Confirm tests inspect actual persisted or exported payloads, not only in-memory builders.
- [ ] Task 4: Add query trace retention and minimization.
  Covers: AC-5
  Acceptance: Student-scoped and class-scoped traces use hash-only query identity, retention windows, minimization boundaries, and export exclusion for expired or restricted details.
  Evidence: Retention/minimization tests and export exclusion tests.
  Reviewer Check: Confirm query trace history is treated as governed learner evidence metadata, not harmless diagnostics.
- [ ] Task 5: Run validation and record evidence.
  Covers: AC-4
  Acceptance: OpenSpec strict validation and targeted tests pass.
  Evidence: Validation command output and test output.
  Reviewer Check: Confirm failures are fixed or explicitly scoped as unrelated before AC approval.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
