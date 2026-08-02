## 1. Freeze the review input

- [x] Verify the manifest slice, exact order, member count, and all bound digests before any review.
- [x] Fail closed if a member, digest, canonical revision, or selected manifest file changes.

## 2. Produce independent conclusions

- [x] Primary reviews each exact member against current course evidence and records a rationale.
- [x] Challenger independently reviews profileOnly/new/changed/highRisk members and records a separate rationale.
- [x] Route every Primary/Challenger conflict to Third and require a terminal Third conclusion; this batch has zero conflicts and no Third stage.
- [x] Preserve 232 role-free `DEFER` conclusions as review-stage terminal `DEFERRED_EVIDENCE_BLOCKED`, leaving CourseCoverage authority unresolved and the global gate blocked.

## 3. Assemble the decision receipt

- [x] Emit a deterministic machine-mergeable receipt keyed by batchId and every binding digest.
- [x] Bind the Primary/Challenger raw source paths and SHA-256 values, normalized stage documents, writer sessions, and provenance closure.
- [x] Seal the provenance path, raw-byte SHA-256, distinct sessions/scopes, source/document bindings, and Challenger non-read audit into `reviewProvenanceBinding` and the receipt digest.
- [x] Reject stripped, protocol-downgraded, and resealed provenance bindings while preserving only the twelve exact tracked historical receipt/attestation path-and-digest pairs.
- [x] Prove the receipt contains no member outside the frozen ordered slice and no production selector/writer-fence mutation.
- [x] Close the v3 production-boundary proof and v2 detached attestation with `receiptDigest` `2309285ee5acef97d6076135c8d9da29fbd642d1053e314b8f867e737a83c347` and `attestationDigest` `1fdf6b0398f01aa590f01e83cb48d834191d8ba9958fad77b603dc0b6a8c5d83`, including identical content-equivalent replay.

## 4. Validate

- [x] Run strict OpenSpec validation for this change.
- [x] Run JSON/source-binding/order/revision checks, confirm zero conflicts, and verify canonical stage/document digests.
- [x] Run focused receipt/manifest checks, identical content-equivalent replay, and `git diff --check`.
