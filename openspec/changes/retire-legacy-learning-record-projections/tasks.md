## 1. Retirement denominator

- [ ] 1.1 Inventory all producers, consumers, workers, queues, materializers, backfills, reports, raw aggregators, legacy services and tests.
- [ ] 1.2 Bind each row to replacement port/API, owner, current revision, watermark/digest receipt, privacy proof and deletion/rollback condition.
- [ ] 1.3 Prove `ground-evidence-copilot`, Arena official authority, Assessment direct fact and Personalization plugin contracts have no retirement regressions.

## 2. Migration and replay evidence

- [ ] 2.1 Freeze comparison baselines and close producer/consumer/worker/backfill/report migration denominators.
- [ ] 2.2 Drain or replay legacy queue inputs with non-destructive, per-message applied/duplicate/failure receipts.
- [ ] 2.3 Compare LearningFact identity, accepted/deduplicated/failed counts, processing/state watermarks, projection revisions and input digests.
- [ ] 2.4 Verify previous qualified current and rollback behavior for projection failures or parity gaps.

## 3. Gated deletion

- [ ] 3.1 Stop and delete old Redis destructive queue/RPOP code only after producer cutover, drain/replay and watermark closure.
- [ ] 3.2 Delete duplicate materializers and legacy projection/services after zero runtime callers and replacement receipts.
- [ ] 3.3 Delete raw page aggregators and keep only explicit authorized audit/debug/migration/drilldown operations.
- [ ] 3.4 Preserve historical LearningFacts, snapshots, transitions, outbox receipts and official results.

## 4. Verification and ledger

- [ ] 4.1 Add concurrency/duplicate/replay tests around each retirement boundary.
- [ ] 4.2 Add crash tests during drain, after receipt, before ack and during pointer publication; prove no message loss or double count.
- [ ] 4.3 Add zero-caller/codegraph, privacy, cross-user and raw-fallback regression tests after deletion.
- [ ] 4.4 Run strict OpenSpec validation, affected domain tests, typecheck and `git diff --check` at each stable deletion checkpoint.
- [ ] 4.5 Run final broad verification on the intended revision and archive the complete retirement ledger.

## 5. Accepted P1 decision B retirement safety

- [ ] 5.1 Require versioned sanitizer, allowlist, retention and deletion receipts for every legacy raw JSON, Redis/batch/outbox and failure/DLQ cleanup path.
- [ ] 5.2 Prove transport, fact, failure, restricted raw artifact and public audit physical/key/ACL isolation; verify no queue/fact/consumer permission inheritance.
- [ ] 5.3 Add recursive forbidden-field and encoding/exception-echo scans, mixed schema/version/unknown digest/ref/retention/ACL negatives and an all-path canary.
- [ ] 5.4 Add kill/restart/duplicate/out-of-order, terminalization atomicity, ACL/replay audit and public-export negative tests.
- [ ] 5.5 Add expiry/deletion tests for successful payload, failure receipt, approved raw and public audit; verify object/index/cache/replica unreadability.
- [ ] 5.6 Add Postgres/Redis/queue/deployment integration tests and stale-caller zero-call tests after each deletion checkpoint.
- [ ] 5.7 Verify rollback cannot restore broad raw JSON/ACL and does not mutate historical facts, snapshots or official results.
