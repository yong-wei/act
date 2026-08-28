## 1. Characterization and registry

- [x] 1.1 Inventory current producers, consumers, workers, backfills, reports, tests, callers, owner, scope, authority, payload and deletion condition.
- [x] 1.2 Record characterization baselines for direct event route, Redis buffer/worker, `LearningEventBatch`, `EventDictionary`, Assessment outbox, Personalization outbox, Arena and ground-evidence-copilot.
- [x] 1.3 Define the versioned discriminator registry and make the database dictionary a checked projection of it.

## 2. Contract and boundary

- [x] 2.1 Define envelope fields for source/action/causation/dedupe, subject/tenant/course/session/scope and authority.
- [x] 2.2 Define field-level privacy classifications, role projections, minimum payload and server-derived identity rules.
- [x] 2.3 Define unknown-version, scope-conflict, authority-conflict, schema and dedupe-collision failure states.
- [x] 2.4 Define the explicit internal-call boundary and document which existing calls remain application API calls.

## 3. Compatibility and vertical migration

- [x] 3.1 Implement a bounded legacy adapter preserving source/version and refusing unsafe identity or causal inference.
- [x] 3.2 Migrate one real interactive producer through the registry and record the revision-bound evidence.
- [x] 3.3 Align Assessment, Personalization and Arena ownership without changing their official authority or plugin contracts.
- [x] 3.4 Keep ground-evidence-copilot on its existing server-authorized context contract; only register its permitted consumer boundary.

## 4. Verification and ledger

- [x] 4.1 Add registry, discriminator, version, causation and dedupe tests, including concurrent duplicate and collision cases.
- [x] 4.2 Add tests proving client identity/scope/authority cannot override server-derived values.
- [x] 4.3 Add compatibility, unknown-version, malformed-payload, privacy-classification and fail-closed tests.
- [x] 4.4 Run strict OpenSpec validation, focused tests, typecheck and `git diff --check`.
- [x] 4.5 Record producer/consumer/worker/backfill/report denominator closure and each compatibility branch deletion condition.

## 5. Accepted P1 anchors and trust boundary

- [x] 5.1 Define immutable `sourceEventId`, applicable `sourceLogId`, canonical knowledge/resource/activity identity, `revision`/`captureRevision`, schema/decoder/materializer versions and preservation rules for direct, outbox, correction, replay and backfill.
- [x] 5.2 Define trusted source classes, `trustedOccurredAt`/`receivedAt`/`materializedAt` versus `reportedClientAt`, clock-skew and late/乱序 stable ordering rules.
- [x] 5.3 Define deterministic anchor/input/trusted-set/output digests, replay immutability and explicit rematerialization/rebase semantics.
- [x] 5.4 Adopt decision B allowlists for transport/outbox, LearningFact, failure/DLQ, restricted raw artifact and public audit, including physical storage, independent keys/ACLs and no permission inheritance.
- [x] 5.5 Define hard retention upper bounds, terminalization-before-delete, deletion receipts, replay authorization, versioned legacy JSON sanitizer and export forbidden-field rules.

## 6. P1 verification and integration

- [x] 6.1 Add anchor-preservation tests for direct/outbox/correction/replay/backfill and negative cross-revision/rebase cases.
- [x] 6.2 Add delayed/乱序, clock-skew, stable-sort, duplicate and decoder-rematerialization determinism tests.
- [x] 6.3 Add recursive forbidden-field and encoding/exception-echo tests over every transport/fact/failure/export path, including an all-path canary.
- [x] 6.4 Add mixed-schema/version, unknown digest/ref/retention/ACL, raw artifact isolation, ACL/replay audit and public-export negative tests.
- [x] 6.5 Add terminalization atomicity, expiry deletion unreadability and object/index/cache/replica deletion-receipt tests.
- [x] 6.6 Add Postgres, Redis, queue and deployment integration tests for claim/restart/duplicate/out-of-order behavior without restoring broad raw JSON.
