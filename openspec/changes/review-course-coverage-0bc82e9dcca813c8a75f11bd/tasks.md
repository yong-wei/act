## 1. Freeze the review input

- [x] Verify the manifest slice, exact order, member count, and all bound digests before any review.
- [x] Fail closed if a member, digest, canonical revision, or selected manifest file changes.

## 2. Produce independent conclusions

- [x] Primary reviews each exact member against current course evidence and records a rationale.
- [x] Challenger independently reviews profileOnly/new/changed/highRisk members and records a separate rationale.
- [x] Route every Primary/Challenger conflict to Third and require a terminal Third conclusion; this batch has zero conflicts and no Third stage.
- [x] Preserve 4 role-free `DEFER` conclusions as review-stage terminal `DEFERRED_EVIDENCE_BLOCKED`, leaving CourseCoverage authority unresolved and the aggregate gate blocked.

## 3. Assemble the decision receipt

- [x] Emit a deterministic machine-mergeable receipt keyed by batchId and every binding digest; the first publication is complete.
- [x] Bind the Primary/Challenger raw source paths and SHA-256 values, normalized stage documents, writer sessions, and provenance closure.
- [x] Prove the receipt contains no member outside the frozen ordered slice and no production selector/writer-fence mutation.
- [x] Publish and replay the v3 production-boundary proof with v2 detached attestation; `receiptDigest` is `f86165449d3216c5d4b4ad5360b7383adeb7e7042fb526e101980251095b58e5` and `attestationDigest` is `5b3d39dbecf1e39470219c43225ea572846b8b6b5d2186a1db39ed54a63ee0f5`, with squash-safe content-equivalent replay.

## 4. Validate

- [x] Run strict OpenSpec validation for this change.
- [x] Run JSON/source-binding/order/revision checks, confirm zero conflicts, and verify canonical stage/document digests.
- [x] Run focused manifest checks and `git diff --check`.
