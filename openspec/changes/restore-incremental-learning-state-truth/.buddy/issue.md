---
change_id: restore-incremental-learning-state-truth
claim_branch: restore-incremental-learning-state-truth
series: learner-state-truth-restoration
coupling_group: none
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/restore-incremental-learning-state-truth
risk: high
area: data-governance
---

## Goal

Restore learner and class analytics to long-term incremental truth: context-only processing advances independently without manufacturing state, inactivity never erases capability, and historical errors migrate through frozen, auditable shadow projections with atomic activation and rollback.

## Scope

- Expand storage with independent processing checkpoints, projection generations, activation control, versioned mutable projections, and a privacy-minimized repair ledger.
- Unify deterministic global and class-scoped effective-state selection across every learner-state consumer.
- Stop time-only writes and admit negative evidence or revocation only through explicit governed contracts.
- Distinguish current roster, historical participation, effective-state coverage, recent activity, freshness, and unresolved state.
- Freeze historical source sets and build idempotent shadow projections before atomic activation.
- Rehearse production-derived migration, post-cutoff catch-up, rollback, and privacy/invariant verification.

## Out of Scope

- New competency formulas, portrait dimensions, evidence sources, or capability inference.
- Re-scoring raw submissions or synthesizing scores without authoritative evidence.
- Broad data-governance backlog, unrelated course repair, or authorization expansion.
- Destructive deletion of historical audit rows or contraction of prior-generation structures.

## Acceptance Checklist

- [ ] AC-1: An append-only journal with per-scope transactional counters held through commit and an independent fenced checkpoint consume context-only, late/backfilled, identical-time, and revocation events exactly once without sequence gaps, while elapsed time and empty windows create no state or unchanged downstream work. Owner: independent reviewer.
  Evidence: tests covering reversed concurrent commit attempts, counter rollback, producer/processor concurrency, repeat/crash recovery, old business times, equal timestamps, revocation after checkpoint, and a later positive fact.
- [ ] AC-2: Every inventoried consumer deterministically returns the active, latest valid state in the requested scope with effective date and freshness separate; direct latest-row selection is gated. Owner: independent reviewer.
  Evidence: selector/order tests, consumer inventory gate, and authenticated student/teacher/AI/report route tests.
- [ ] AC-3: Only fully admitted governed negative evidence can decrease declared dimensions, while partial/full revocation recomputes remaining evidence and ambiguity fails closed. Owner: independent reviewer.
  Evidence: admission, inactivity, partial-positive revocation, negative revocation, class authorization, missing/tampered lineage, and bounded-update fixtures.
- [ ] AC-4: Repair freezes a consistent journal cutoff and exact record set, rejects drift, deterministically audits, idempotently resumes apply, preserves history, replays post-cutoff events into both generations, and reaches zero unapproved unresolved records. Owner: independent reviewer.
  Evidence: signed manifest/checksum fixtures, interruption/concurrency tests, repeated apply with zero writes, and all-generation invariants.
- [ ] AC-5: Current-roster and historical class projections use explicit event-time class/session provenance, handle transfers, and never import global or other-class evidence when membership is unknown. Owner: independent reviewer.
  Evidence: transfer, historical participant, missing provenance, same-task cross-class, and population-at-snapshot fixtures.
- [ ] AC-6: A fresh production import completes privacy-minimized audit/apply/verify with reviewed classifications, zero unapproved unresolved records, and representative corrected records including 2024 automation; journal and repair artifacts contain no copied content or direct identity. Owner: independent reviewer.
  Evidence: redacted before/after report, aggregate/pseudonymous evidence, journal schema/access/retention/log privacy checks, and invariant output.
- [ ] AC-7: Inactivity, stale freshness, context-only activity, retries, and migration reruns do not suppress valid recommendations, manufacture weaknesses, resolve risks, duplicate growth/recommendation rows, rebuild unchanged summaries/caches, or republish outbox work; revocation changes only affected derivatives. Owner: independent reviewer.
  Evidence: downstream behavior and cardinality integration tests across both generations.
- [ ] AC-8: Shadow projections remain invisible until both generations reach each scope's contiguous watermark under state and outbox-claim barriers; claimed leases drain and receivers enforce fence epochs; continued v1 synchronization and equal-watermark rollback prevent mixed, stale, revived, duplicated, or post-switch old-generation effects. Owner: independent reviewer.
  Evidence: cutover/rollback tests including a worker paused after generation check but before send, lease expiry/reclaim, stale receiver rejection, dedupe preservation, backlog/active-generation queries, metric contracts, and rehearsal.

## Tasks

- [ ] Task 1: Expand storage and implement deterministic scoped state selection.
  Covers: AC-1, AC-2, AC-8
  Acceptance: The privacy-minimized journal with commit-safe per-scope counters, independent checkpoints, projection generations, activation control, versioned mutable projections, shared ordering, and direct-reader gate exist while v1 remains active.
  Evidence: schema/migration, commit-order/rollback-gap, selector, privacy, inventory-gate, and dual-reader tests.
  Reviewer Check: Confirm scope keys, contiguous commit ordering, authority/tie-break, privacy, fencing, rollback generation, and consumer coverage.
- [ ] Task 2: Correct student, portrait-v2, class, negative-evidence, and revocation materialization.
  Covers: AC-1, AC-3, AC-5, AC-7
  Acceptance: Processing no longer writes from time alone, checkpoints consume context exactly once, negative evidence passes the full admission predicate, and revocation recomputes only authorized remaining scope.
  Evidence: worker, admission, revocation, transfer, retry, and downstream no-op tests.
  Reviewer Check: Confirm no aging-only path, free-string negative admission, global-to-class fallback, or time-only risk/recommendation transition remains.
- [ ] Task 3: Align consumers, freshness, downstream behavior, and class metrics.
  Covers: AC-2, AC-5, AC-7, AC-8
  Acceptance: All consumers read one active generation, expose stable date/freshness fields, and distinguish roster, coverage, activity, stale, never-evidenced, revoked, and unresolved populations with denominators.
  Evidence: authenticated route, recommendation, report, cache/summary, metric, and direct-reader gate tests.
  Reviewer Check: Confirm historical coverage is not labeled activity and stale freshness cannot create weakness or suppress valid state-derived behavior.
- [ ] Task 4: Implement frozen-manifest audit/apply/verify and shadow projections.
  Covers: AC-3, AC-4, AC-5, AC-6, AC-7
  Acceptance: Consistent cutoff, immutable record checksums, ambiguous override policy, pseudonymization, source-drift rejection, idempotent batches, and all dependent v2 projections are complete without touching v1.
  Evidence: manifest snapshots, concurrency/interruption tests, privacy checks, repeated apply, and all-generation invariant queries.
  Reviewer Check: Confirm revocations cannot be revived by heuristic classification, zero unapproved unresolved is enforced, and migration outputs contain no raw or direct personal identifiers.
- [ ] Task 5: Rehearse production-derived migration, activation, catch-up, and rollback.
  Covers: AC-4, AC-5, AC-6, AC-8
  Acceptance: A fresh production import proves representative repair, contiguous cutoff continuity, drained in-flight leases, receiver-fenced atomic activation/rollback, preserved synchronized v1 projections, and explicit unresolved handling.
  Evidence: redacted report, before/after counts, active-generation/lease/fence checks, post-cutoff events, paused-before-send concurrency test, and 2024 automation verification.
  Reviewer Check: Confirm the manifest uses commit-safe cutoffs, no pre-expansion binary is used, stale deliveries cannot apply or consume dedupe, and rollback is non-destructive.
- [ ] Task 6: Complete validation and high-risk clearance.
  Covers: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8
  Acceptance: Typecheck, data-governance, journal ordering, migration/concurrency, barrier/outbox, affected route and downstream tests, privacy checks, and strict OpenSpec validation pass on the final diff.
  Evidence: final command output and data-governance plus critical independent review reports.
  Reviewer Check: Confirm evidence belongs to the final diff and explicitly approve or reject each AC before checklist updates.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
