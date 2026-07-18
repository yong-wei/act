## 1. Expand state and selection contracts

- [ ] 1.1 Inventory profile, competency, Konling, planner, recommendation, control-correction, teacher, session/reporting, cache, summary, growth, risk, outbox, and admin consumers; add a gate rejecting lifecycle-sensitive direct latest-row selection.
- [ ] 1.2 Add the privacy-minimized append-only journal with per-scope transactional counters held through commit, projection-generation registry, atomic activation pointer, independent checkpoint with fencing, versioned shadow projections, and repair ledger.
- [ ] 1.3 Implement the shared scoped selector with authority rank, source watermark, total ordering, active-generation filtering, ambiguous fail-closed behavior, and deterministic tests.

## 2. Correct incremental processing

- [ ] 2.1 Remove time-only aging scheduling and transactionally advance contiguous journal checkpoints without state writes; cover reversed concurrent commit attempts, counter rollback without gaps, producer/processor concurrency, identical timestamps, late facts, backfill, retry, later positive facts, and revocation after checkpoint.
- [ ] 2.2 Enforce the negative-evidence admission predicate and dimension-bounded updates; implement revocation as remaining-evidence recomputation with partial-positive, negative-revocation, and missing-lineage tests.
- [ ] 2.3 Make class processing use explicit class/session provenance, distinguish current roster from historical population, retain unchanged effective state, and cover transfer and unknown-membership cases.

## 3. Align consumers and metrics

- [ ] 3.1 Migrate all inventoried student, AI, recommendation, report, teacher, and admin readers to one active generation and shared selector; expose stable effective-date and freshness fields.
- [ ] 3.2 Separate enrolled, effective-state, recent-active, stale, never-evidenced, revoked, and unresolved metrics and disclose included counts/denominators for every class average and distribution.
- [ ] 3.3 Verify inactivity and context-only activity do not clear recommendations, create weaknesses, resolve risks, create growth records, rebuild unchanged cache/summary, or publish outbox work; revocation changes only affected derivatives.

## 4. Freeze and migrate historical truth

- [ ] 4.1 Implement consistent-snapshot `audit` with per-scope contiguous journal cutoffs, exact IDs/checksums, canonical serialization, signed overrides, stable pseudonyms, journal/repair retention metadata, and zero writes.
- [ ] 4.2 Implement bounded `apply` over the immutable manifest with per-scope checksum verification, advisory locks, idempotent resume, source-drift rejection, zero-unapproved-unresolved gate, and shadow-generation writes only.
- [ ] 4.3 Implement `verify` for all generations, lineage, duplicate/effective-state invariants, class boundaries, downstream cardinality, privacy, and post-cutoff checkpoint continuity.

## 5. Rehearse activation and rollback

- [ ] 5.1 Restore a fresh production export locally; run audit/apply/verify, review every ambiguous record, and record redacted before/after counts and representative repaired learners/classes including 2024 automation.
- [ ] 5.2 Rehearse dual-generation replay, final state/outbox-claim barrier, unresolved reservation and claimed-lease drain, equal-watermark activation, receiver fence epoch, stale-delivery rejection without dedupe consumption, continued v1 synchronization, and equal-watermark rollback.
- [ ] 5.3 Document production backup, conflicting worker/outbox drain, cutoff creation, bounded apply, activation, monitoring, rollback, artifact access/retention, and prohibition on pre-expansion binaries after migration.

## 6. Validate and review

- [ ] 6.1 Run typecheck, data-governance and affected route/recommendation tests, commit-order and outbox TOCTOU concurrency suites, direct-reader gate, journal/repair privacy checks, and strict OpenSpec validation.
- [ ] 6.2 Obtain data-governance and independent high-risk clearance on the final diff and AC evidence before any checklist update or production operation.
