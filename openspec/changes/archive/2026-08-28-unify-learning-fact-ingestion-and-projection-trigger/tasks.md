## 1. Characterization and API

- [x] 1.1 Inventory every direct fact writer, event route, Redis worker, batch, outbox, backfill, scheduler and snapshot enqueue caller.
- [x] 1.2 Capture direct/core, secondary, Assessment, Personalization and historical backfill count, dedupe, failure and trigger baselines.
- [x] 1.3 Define the canonical ingestion application API and its normalized result/status contract.

## 2. Transaction and transport

- [x] 2.1 Implement direct same-transaction fact ingestion with one projection trigger intent.
- [x] 2.2 Implement the real cross-process staging outbox path using the same ingestion API and explicit `staged`/`deduplicated`/`applied` states.
- [x] 2.3 Remove direct-plus-outbox double-write paths and document producer mode in the migration ledger.
- [x] 2.4 Replace destructive queue processing with claim/lease or equivalent recoverable ack-after-success behavior.

## 3. Projection trigger and migration

- [x] 3.1 Make core, secondary, Assessment, Personalization and backfill inputs derive the same trigger key and affected subject set.
- [x] 3.2 Preserve processing/state watermark separation and generation/revision fences.
- [x] 3.3 Migrate one vertical producer and compare accepted, deduplicated, failed and triggered denominators.
- [x] 3.4 Migrate remaining producers only after the vertical evidence is revision-bound.

## 4. Verification and ledger

- [x] 4.1 Add concurrent duplicate, dedupe-collision, replay and partial-batch tests.
- [x] 4.2 Add crash tests before claim, after fact commit, before trigger commit, after trigger commit and before ack.
- [x] 4.3 Add tests proving no message loss, no destructive pre-processing removal and no direct-plus-outbox double write.
- [x] 4.4 Add privacy/authority tests for staging payloads and terminal failure records.
- [x] 4.5 Run strict OpenSpec validation, focused ingestion/worker tests, typecheck and `git diff --check`.
- [x] 4.6 Record every producer mode, denominator, replay receipt, trigger receipt and legacy deletion condition.

## 5. Accepted P1 anchors and deterministic ingestion

- [x] 5.1 Preserve `sourceEventId`, applicable `sourceLogId`, canonical knowledge/resource/activity identity, revision/captureRevision and schema/decoder/materializer versions across direct, outbox, correction, replay and backfill.
- [x] 5.2 Define trusted source classes, trusted occurrence/received/materialized/client-reported times, clock skew, late input and stable out-of-order sorting.
- [x] 5.3 Add explicit cross-revision reject/rebase and decoder/materializer rematerialization state without mutating original anchors or times.
- [x] 5.4 Make input digest, trusted-set digest and projection trigger deterministic across direct, replay, backfill and delivery permutations.

## 6. Decision B trust boundary and lifecycle tests

- [x] 6.1 Enforce recursive forbidden-field and encoding/exception-echo checks on every transport, outbox, fact, failure/DLQ and export path; add an all-path canary.
- [x] 6.2 Add kill/restart, duplicate, claim/retry, terminalization and out-of-order tests across Postgres, Redis and queue delivery.
- [x] 6.3 Add mixed schema/version, unknown digest/ref/retention/ACL, raw artifact isolation, ACL/replay audit and public-export negative tests.
- [x] 6.4 Add atomic terminal receipt, retention expiry and deletion-unreadability tests for object/index/cache/replica, including successful-payload deletion.
- [x] 6.5 Add deployment integration tests proving the allowlist/sanitizer and ack-after-success behavior survive restart and version rollout.
- [x] 6.6 Record retention, sanitizer, raw-artifact and replay authorization receipts in the producer/worker/backfill denominator ledger.
