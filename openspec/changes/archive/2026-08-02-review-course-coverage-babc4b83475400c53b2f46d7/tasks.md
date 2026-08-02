## 1. Freeze the review input

- [x] Verify the manifest slice, exact order, member count, and all bound digests before any review.
- [x] Fail closed if a member, digest, canonical revision, or selected manifest file changes.

## 2. Produce independent conclusions

- [x] Primary reviews each exact member against current course evidence and records a rationale.
- [x] Challenger independently reviews profileOnly/new/changed/highRisk members and records a separate rationale.
- [x] Route every Primary/Challenger conflict to Third and require a terminal Third conclusion; this batch has zero conflicts and no Third stage.
- [x] Preserve 118 role-free `DEFER` conclusions as review-stage terminal `DEFERRED_EVIDENCE_BLOCKED`, leaving CourseCoverage authority unresolved and the aggregate gate blocked.

## 3. Assemble the decision receipt

- [x] Emit a deterministic machine-mergeable receipt keyed by batchId and every binding digest.
- [x] Bind the Primary/Challenger raw source paths and SHA-256 values, normalized stage documents, writer sessions, and provenance closure.
- [x] Prove the receipt contains no member outside the frozen ordered slice and no production selector/writer-fence mutation.
- [x] Close the v3 production-boundary proof and v2 detached attestation with `receiptDigest` `a6736d12049c2132a2d22fce2d7619e533200fec561e56eaf2809ae87d04cc6a` and `attestationDigest` `5888a709321f639dd5473f8ddc9c40b3df1851d015d0ae9387daa471e0ee28e7`, including squash-safe content-equivalent replay.

## 4. Validate

- [x] Run strict OpenSpec validation for this change.
- [x] Run JSON/source-binding/order/revision checks, confirm zero conflicts, and verify canonical stage/document digests.
- [x] Run focused receipt/manifest checks, squash-safe replay, and `git diff --check`.
