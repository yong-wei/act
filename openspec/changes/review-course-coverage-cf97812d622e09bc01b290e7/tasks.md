## 1. Freeze the review input

- [ ] Verify the manifest slice, exact order, member count, and all bound digests before any review.
- [ ] Fail closed if a member, digest, canonical revision, or selected manifest file changes.

## 2. Produce independent conclusions

- [ ] Primary reviews each exact member against current course evidence and records a rationale.
- [ ] Challenger independently reviews profileOnly/new/changed/highRisk members and records a separate rationale.
- [ ] Route every Primary/Challenger conflict to Third and require a terminal Third conclusion.

## 3. Assemble the decision receipt

- [ ] Emit a deterministic machine-mergeable receipt keyed by batchId and every binding digest.
- [ ] Prove the receipt contains no member outside the frozen ordered slice and no production selector/writer-fence mutation.

## 4. Validate

- [ ] Run strict OpenSpec validation for this change.
- [ ] Run focused receipt/manifest checks and `git diff --check`.
