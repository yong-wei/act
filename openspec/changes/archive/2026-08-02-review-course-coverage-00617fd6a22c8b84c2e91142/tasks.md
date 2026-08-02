## 1. Freeze the review input

- [x] Verify the manifest slice, exact order, member count, and all bound digests before any review.
- [x] Fail closed if a member, digest, canonical revision, or selected manifest file changes.

## 2. Produce independent conclusions

- [x] Primary reviews each exact member against current course evidence and records a rationale in a byte-preserved independent source.
- [x] Challenger independently reviews the entire profileOnly/highRisk batch in a fresh source-writing session without reading Primary.
- [x] Route every Primary/Challenger conflict to Third and require a terminal Third conclusion; this batch has zero conflicts and no Third artifact.
- [x] Preserve 147 role-free `DEFER` conclusions with insufficient evidence, leaving CourseCoverage authority unresolved and the global gate blocked.

## 3. Assemble the decision receipt

- [x] Emit a deterministic machine-mergeable receipt keyed by batchId and every binding digest.
- [x] Bind raw-source byte digests, distinct writer sessions/scopes, normalized v2 documents, and the Challenger non-read audit through `review-provenance.json`.
- [x] Publish the v3 receipt and v2 detached attestation, then run an identical content-equivalent replay.
- [x] Prove the receipt contains no member outside the frozen ordered slice and no production selector/writer-fence mutation.

## 4. Validate

- [x] Run strict OpenSpec validation for this change.
- [x] Run focused receipt/manifest checks, normalized-stage tests, replay, and `git diff --check`.
