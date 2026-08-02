## 1. Freeze the review input

- [x] Verify the manifest slice, exact order, member count, and all bound digests before any review.
- [x] Fail closed if a member, digest, canonical revision, or selected manifest file changes.

## 2. Produce independent conclusions

- [x] Primary reviews each exact member against current course evidence and records a rationale (`fd2080b4-43de-43e0-862d-272b84300271`; `204/204 DEFER`).
- [x] Challenger independently reviews the `202` profileOnly/new/changed/highRisk risk-slice members and records a separate rationale (`bca2c71c-055d-4a2f-875b-7fb9e4ec8a77`; `202/202 DEFER`); non-risk frozen ordinals `2` and `24` are explicitly omitted by the shared CLI contract.
- [x] Route every Primary/Challenger conflict to Third and require a terminal Third conclusion; observed conflicts `0`, Third `0`.

## 3. Assemble the decision receipt

- [x] Emit a deterministic machine-mergeable receipt keyed by batchId and every binding digest (`receiptDigest=ddde95cd1ead7719aba464043941f05b096eff3c76f80500e94f768e7f7e9b66`).
- [x] Prove the receipt contains no member outside the frozen ordered slice and no production selector/writer-fence mutation; detached attestation `9fdce2d23a9fb9b3003bdb6c9d7cf36119597d2eae8d7afa46b09744b018ccd0` records the unchanged authority snapshot.

## 4. Validate

- [x] Run strict OpenSpec validation for this change.
- [x] Run raw-to-normalized closure, first publication and identical replay, focused Vitest, full artifact/order/binding/digest/no-absolute-path verifier, and `git diff --check`.
