## 1. Characterization and contract

- [ ] 1.1 Inventory generic hardcoded course/lesson/Arena IDs, keyword branches, reducers, snapshot writers, consumers, backfills, reports and tests.
- [ ] 1.2 Capture control-correction fact, projection, Personalization and Arena official-result baselines with revision and authority.
- [ ] 1.3 Define the adapter contract, shared plugin registry entry, version, release/capture identity and deletion condition.

## 2. Adapter implementation

- [ ] 2.1 Implement explicit `goalId=control-correction` resolution and normalized evidence mapping inside the course/plugin adapter.
- [ ] 2.2 Reject missing, ambiguous, stale or mismatched goal/lesson/Arena identity without keyword/default-course inference.
- [ ] 2.3 Keep generic Learning Record, reducers and read ports free of course identifiers and expose only normalized permitted fields.
- [ ] 2.4 Preserve Arena official authority and Personalization plugin interface, including conflict and provenance semantics.

## 3. Vertical migration and deletion

- [ ] 3.1 Migrate one real control-correction lesson/Arena vertical slice and bind its output to adapter/source/projection revisions.
- [ ] 3.2 Migrate remaining producers, state consumers, Personalization callers, backfills and reports.
- [ ] 3.3 Remove generic hardcoded constants, keyword branches and compatibility facades only after zero-caller evidence.

## 4. Verification and ledger

- [ ] 4.1 Add adapter contract, explicit goal, release/capture revision and ambiguous-match tests.
- [ ] 4.2 Add concurrency/replay and crash tests proving mapping remains idempotent and cannot overwrite official Arena authority.
- [ ] 4.3 Add privacy/role/minimum-field tests for student, teacher, AI and Personalization projections.
- [ ] 4.4 Add missing-plugin, stale-revision, authority-conflict and fail-closed tests.
- [ ] 4.5 Run strict OpenSpec validation, affected control/Personalization tests, typecheck and `git diff --check`.
- [ ] 4.6 Record producer/consumer/backfill/report denominator closure and every removed hardcode's evidence.

## 5. Accepted P1 anchors and deterministic adapter

- [ ] 5.1 Preserve sourceEventId/sourceLogId, canonical knowledge/resource/activity identity, revision/captureRevision and schema/decoder/materializer versions across direct, outbox, correction, replay and backfill.
- [ ] 5.2 Test trusted/server/client-reported time separation, clock skew, delayed/乱序 stable ordering, anchor preservation and deterministic trusted-set/output digests.
- [ ] 5.3 Add negative mixed-schema/cross-revision/rebase, stale/ambiguous identity and explicit decoder-rematerialization tests.

## 6. Decision B allowlist and lifecycle verification

- [ ] 6.1 Enforce recursive forbidden-field and encoding/exception-echo checks on adapter input/output, transport, fact, failure/DLQ and export paths; add an all-path canary.
- [ ] 6.2 Verify raw artifact physical/key/ACL isolation, no permission inheritance, versioned legacy sanitizer and redacted failure receipts.
- [ ] 6.3 Add replay scope/purpose/ticket/elevated-authority/two-person audit tests and public-export negative tests.
- [ ] 6.4 Add terminalization/deletion atomicity, retention upper-bound and object/index/cache/replica unreadability tests.
- [ ] 6.5 Add kill/restart/duplicate/out-of-order tests plus Postgres/Redis/queue/deployment integration for adapter mapping and official Arena boundary.
- [ ] 6.6 Record retention, sanitizer, raw-artifact and replay receipts in the control-correction producer/consumer/backfill/report ledger.
