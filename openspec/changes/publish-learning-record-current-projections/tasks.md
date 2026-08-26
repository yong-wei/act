## 1. Characterization and model boundary

- [ ] 1.1 Inventory snapshot writers, current-pointer writers, caches, raw aggregators, routes, ports, backfills, reports and tests.
- [ ] 1.2 Record per projection input facts, watermarks, revisions, digests, quality, privacy, owner and deletion condition.
- [ ] 1.3 Define the immutable snapshot, role read model, current pointer and historical retention boundary.

## 2. Publication contract

- [ ] 2.1 Define publication envelope with processing/state watermark, revision, generation, input digest, coverage, freshness, confidence and qualification.
- [ ] 2.2 Implement atomic pointer publication with subject/scope and generation/revision/cutover fences.
- [ ] 2.3 Define stale, partial, unavailable, conflict and failed-publication states while retaining the previous qualified current.
- [ ] 2.4 Reuse trusted fact quality, canonical identity and privacy/role projection rules without creating duplicate filters.

## 3. Vertical migration

- [ ] 3.1 Migrate one student evidence/portrait projection and prove fact-to-version-to-current traceability.
- [ ] 3.2 Migrate one teacher scoped read model with independent-learner small-sample suppression.
- [ ] 3.3 Define AI/Personalization safe read-port fields and preserve ground-evidence-copilot server authorization.
- [ ] 3.4 Remove no raw aggregator until the consumer ledger proves zero required callers and a replacement receipt exists.

## 4. Verification and ledger

- [ ] 4.1 Add concurrent publish, stale candidate, revision conflict and duplicate replay tests.
- [ ] 4.2 Add crash tests between immutable version write and pointer CAS, and between pointer publish and cache refresh.
- [ ] 4.3 Add tests proving projections never read raw events for normal page responses and always retain provenance.
- [ ] 4.4 Add role, cross-user, teacher/admin separation, privacy and independent-learner small-sample tests.
- [ ] 4.5 Run strict OpenSpec validation, affected projection tests, typecheck and `git diff --check`.
- [ ] 4.6 Record watermark/revision/digest receipts and remaining legacy projection retirement gates.

## 5. Accepted P1 anchors and decision B boundary

- [ ] 5.1 Preserve sourceEventId/sourceLogId, canonical knowledge/resource/activity identity, revision/captureRevision and schema/decoder/materializer versions in every snapshot, current pointer and receipt.
- [ ] 5.2 Test trustedOccurredAt/receivedAt/materializedAt/reportedClientAt separation, clock skew, delayed/乱序 stable ordering and replay/correction/backfill anchor preservation.
- [ ] 5.3 Test deterministic input/trusted-set/output digests and negative cross-revision/mixed-schema cases; verify explicit decoder rematerialization.
- [ ] 5.4 Enforce projection allowlists and recursive forbidden-field/encoding/exception-echo checks with an all-path canary.
- [ ] 5.5 Verify raw artifact physical/key/ACL isolation, redacted failure/conflict receipts, no permission inheritance and public-export negative cases.
- [ ] 5.6 Verify retention hard caps, terminalization-before-delete, expiry deletion receipts and object/index/cache/replica unreadability.
- [ ] 5.7 Add Postgres/Redis/queue/deployment integration coverage for candidate crash, restart, duplicate, out-of-order and rematerialization behavior.
