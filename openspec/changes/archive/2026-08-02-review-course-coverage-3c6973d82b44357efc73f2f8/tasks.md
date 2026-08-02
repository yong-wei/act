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
- [x] Prove the receipt contains no member outside the frozen ordered slice and no production selector/writer-fence mutation.
- [x] Close the v3 production-boundary proof and v2 detached attestation with `receiptDigest` `09162ee3c9fdd879bd345f75e3ff67a61fcbf1c469bab109b3b20fee61fb5ac1` and `attestationDigest` `68597747729284c179171cc1b414721388df9cd89e1684e54d2590c8de0a51e8`, including identical content-equivalent replay.

## 4. Validate

- [x] Run strict OpenSpec validation for this change.
- [x] Run JSON/source-binding/order/revision checks, confirm zero conflicts, and verify canonical stage/document digests.
- [x] Run focused receipt/manifest checks, identical content-equivalent replay, and `git diff --check`.
