## 1. Freeze the review input

- [x] Verify the manifest slice, exact order, member count, and all bound digests before any review.
- [x] Fail closed if a member, digest, canonical revision, or selected manifest file changes.

## 2. Produce independent conclusions

- [x] Primary reviews each exact member against current course evidence and records a rationale.
- [x] Challenger independently reviews profileOnly/new/changed/highRisk members and records a separate rationale.
- [x] Route every Primary/Challenger conflict to Third and require a terminal Third conclusion; preserve an agreed DEFER as `DEFERRED_EVIDENCE_BLOCKED` without assigning a CourseCoverage role.

## 3. Assemble the review receipt

- [x] Emit a deterministic machine-mergeable receipt keyed by batchId and every binding digest.
- [x] Prove the receipt contains no member outside the frozen ordered slice and no production selector/writer-fence mutation.

## 4. Validate

- [x] Run strict OpenSpec validation for this change.
- [x] Run focused receipt/manifest checks and `git diff --check`.
