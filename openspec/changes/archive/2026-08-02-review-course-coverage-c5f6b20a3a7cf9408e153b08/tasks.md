## 1. Freeze the review input

- [x] Verify the manifest slice, exact order, member count, and all bound digests before any review. (`500` members; member/worklist/manifest bindings and manifest artifact SHA-256 match.)
- [x] Fail closed if a member, digest, canonical revision, or selected manifest file changes. (Shared CLI revalidates the frozen closure before assembly.)

## 2. Produce independent conclusions

- [x] Primary reviews each exact member against current course evidence and records a rationale. (`primary-review.json`; 500 DEFER.)
- [x] Challenger independently reviews profileOnly/new/changed/highRisk members and records a separate rationale. (`challenger-review.json`; 500 DEFER; sessions remain independent.)
- [x] Route every Primary/Challenger conflict to Third and require a terminal Third conclusion. (Zero conflicts; no Third artifact is permitted or emitted.)

## 3. Assemble the decision receipt

- [x] Emit a deterministic machine-mergeable receipt keyed by batchId and every binding digest. (`receiptDigest=eaf06a0180e0d4b8acd4e35283a3d7baa546cef318a99855c03260a5beb12c65`; detached v2 attestation `attestationDigest=a5fe78541257603d477145aa7fe89056ad2f38c884d15b8ad2a0cd7052944066`.)
- [x] Prove the receipt contains no member outside the frozen ordered slice and no production selector/writer-fence mutation. (v3 ordered protected-path digests; all mutation flags false; 500 ordered terminal rows.)

## 4. Validate

- [x] Run strict OpenSpec validation for this change.
- [x] Run focused receipt/manifest checks, shared CLI first publication plus content-equivalent replay, JSON parse, absolute-path scan, and `git diff --check`.
