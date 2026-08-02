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
- [x] Reject stripped or retained-binding protocol downgrade and reseal attacks while preserving only the eighteen exact tracked historical receipt/attestation path-and-digest pairs.
- [x] Prove the receipt contains no member outside the frozen ordered slice and no production selector/writer-fence mutation.
- [x] Close the v3 production-boundary proof and v2 detached attestation with `receiptDigest` `2309285ee5acef97d6076135c8d9da29fbd642d1053e314b8f867e737a83c347` and `attestationDigest` `1fdf6b0398f01aa590f01e83cb48d834191d8ba9958fad77b603dc0b6a8c5d83`, including identical content-equivalent replay.

## 4. Validate

- [x] Run strict OpenSpec validation for this change.
- [x] Run JSON/source-binding/order/revision checks, confirm zero conflicts, and verify canonical stage/document digests.
- [x] Run focused receipt/manifest checks, identical content-equivalent replay, and `git diff --check`.

## 5. Current-head Sol medium O1 accepted decision

- [x] Activate the frozen policy only for the exact #1200 receipt path after public-boundary path binding is verified.
- [x] Compare the complete batch binding, ordered protected paths, fixed stage sessions/scopes, and provenance SHA without fixing receipt or attestation digests.
- [x] Preserve historical no-binding allowlists, non-#1200 general bound subset behavior, external provenance boundaries, and immutable receipt artifacts.
- [x] Verify with focused Vitest, TypeScript typecheck, strict OpenSpec change validation, and `git diff --check`.

## 6. Current-head Sol medium O2 accepted integration decision

- [x] Semantically merge the advanced integration contracts with the local #1200 frozen closure; retain both instead of choosing either branch wholesale.
- [x] Keep #1200 exact-path v3 provenance/audit closure local, retain integration stage-v2 evidence identity and persisted v1-stage replay, and confine each legacy admission rule to its verified compatibility boundary.
- [x] Verify the merged focused receipt suite, TypeScript typecheck, and `git diff --check` without changing immutable review artifacts or historical allowlists.

## 7. Current-head Sol medium O3 accepted historical replay remediation

- [x] Read the real Issue 1213, 1214, and 1218 receipt/attestation artifacts and record their complete repository-relative paths, batch identities, v3/v2 protocols, no-binding state, and exact digest values.
- [x] Add only those three complete four-tuples to `CURRENT_COURSE_COVERAGE_HISTORICAL_NO_BINDING_DIGEST_PAIRS`, changing the documented count from fifteen to eighteen; do not add a schema, protocol, or missing-field fallback.
- [x] Test that each of the three artifact pairs classifies as `HISTORICAL_V3_NO_BINDING` and that unknown pairs plus path, receipt-digest, or attestation-digest drift remain rejected.
- [x] Preserve bundle assertion ordering, legacy-stage admission boundaries, new-publication provenance binding, and the #1200 frozen provenance/audit closure.
- [x] Verify focused Vitest, TypeScript typecheck, `git diff --check`, and identical/content-equivalent CLI replay for Issues 1213, 1214, and 1218 while leaving all receipt, attestation, and provenance artifacts unchanged.
