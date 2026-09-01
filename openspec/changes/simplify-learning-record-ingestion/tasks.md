## 1. Capture the behavior baseline

- [ ] 1.1 Import C6/C7 owner-migration receipts and freeze a clean post-migration revision.
- [ ] 1.2 Record ingestion callers, wrappers, parsers, guards, dedupe/trigger helpers, side effects and direct/outbox transport boundaries.
- [ ] 1.3 Add or confirm characterization tests for applied, duplicate, collision, retryable/terminal failure, forbidden field, clock skew, cross-revision, out-of-order, replay and backfill cases.

## 2. Apply one simplification at a time

- [ ] 2.1 Use the code-simplification process to understand each candidate's callers, callee, edge cases, historical reason and tests before editing.
- [ ] 2.2 Consolidate only equivalent normalized input, anchor/time, allowlist, dedupe and trigger logic while retaining explicit transport boundaries.
- [ ] 2.3 After each change run the direct ingestion and outbox/worker regression tests and compare before/after outputs, errors, side effects, ordering and digests.
- [ ] 2.4 Reject or defer any simplification that changes an external contract, authority, privacy, timestamp, retention, replay or rollback behavior.

## 3. Delete obsolete implementation paths

- [ ] 3.1 Prove zero required callers for duplicate envelope/parser, idempotency-key and internal-guard wrappers with static and dynamic canaries.
- [ ] 3.2 Delete only the proven obsolete code and imports/tests made unreachable by this change; preserve explicit compatibility adapters and historical tools.
- [ ] 3.3 Re-run architecture/dependency evidence and confirm complexity/dependency counts decrease without a new allowlist or forwarding facade.

## 4. Verify handoff to C9

- [ ] 4.1 Run ingestion/event-contract, PostgreSQL transaction, outbox/worker crash/retry, privacy and retention tests.
- [ ] 4.2 Run `rtk npm run typecheck`, `rtk openspec validate simplify-learning-record-ingestion --type change --strict` and `rtk git diff --check`.
- [ ] 4.3 Record before/after characterization and the final deletion set; hand off the stable ingestion boundary to C9 without changing projection or backfill semantics.
