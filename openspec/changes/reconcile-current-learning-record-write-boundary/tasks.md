## 1. Freeze the current write denominator

- [ ] 1.1 Bind the producer inventory to the C0 capture SHA and enumerate interactive routes, domain writers, workers, outboxes, schedulers, backfills, reports and tests.
- [ ] 1.2 Record owner, transport, dedupe identity, anchors, trusted/server times, privacy class, projection trigger, consumer, evidence and deletion condition for every row.
- [ ] 1.3 Classify each row as direct same-transaction, staged/outbox, correction/replay or explicit backfill; reject directory-based owner assumptions.

## 2. Reconcile the canonical boundary

- [ ] 2.1 Prove that the existing canonical ingestion/write boundary and event registry remain the only protocol/acceptance authority, without adding a second event contract or prematurely migrating C6/C7 adapters.
- [ ] 2.2 Add characterization coverage for direct/outbox equivalence, concurrent retries, dedupe collision, anchor/time preservation, privacy rejection, cross-revision and out-of-order delivery.
- [ ] 2.3 Distinguish internal typed application calls from cross-process staging and prove that no internal call emits a duplicate event solely for protocol compliance.
- [ ] 2.4 Verify backfill inputs use explicit authorization, frozen cutoffs, run identity and current-pointer guards, and cannot masquerade as online delivery.

## 3. Remove only proven duplicate writes

- [ ] 3.1 Compare API direct materialization, Redis worker materialization and `EvidenceOutbox` delivery for the same logical source identity.
- [ ] 3.2 Delete or isolate only duplicate writers with zero required callers, replacement parity and rollback evidence; retain unresolved external/audit paths with a documented exception.
- [ ] 3.3 Re-run producer denominator, static all-path canary and architecture dependency evidence after each deletion.

## 4. Verify and hand off

- [ ] 4.1 Run affected ingestion, event-buffer, worker, Assessment, Arena, Personalization and PostgreSQL integration tests without weakening existing assertions.
- [ ] 4.2 Run `rtk npm run typecheck`, `rtk openspec validate reconcile-current-learning-record-write-boundary --type change --strict`, `rtk openspec validate --specs --strict` and `rtk git diff --check` on the final revision.
- [ ] 4.3 Record the exact owner/deletion ledger and hand off the accepted writer boundary to C6 and C7; do not mark downstream migration complete here.
