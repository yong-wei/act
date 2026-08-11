## 1. Freeze the review input

- [x] Verify the manifest slice, exact order, member count, canonical revision, and all bound digests before review.
- [x] Fail closed unless the frozen member, digest, revision, and manifest file all match.

## 2. Produce independent conclusions

- [x] Primary reviews the exact member independently and records its rationale.
- [x] Challenger independently reviews the profileOnly/highRisk member and records a separate rationale.
- [x] Preserve the no-conflict result; no Third is created.
- [x] Record the discovered 3-3 course authority as a candidate only: it is not a frozen `independent-course` reference, so this child remains `DEFER` pending #1180 bind/classify/re-freeze.

## 3. Assemble the decision receipt

- [x] Emit a deterministic machine-mergeable receipt keyed by batchId and every binding digest.
- [x] Prove the receipt contains no member outside the frozen ordered slice and no production selector/writer-fence mutation.

## 4. Validate

- [x] Run strict OpenSpec validation for this change.
- [x] Run focused receipt/manifest checks, receipt/attestation replay, full test, typecheck, and `git diff --check`.

## 5. Recover rejected provenance chain

- [x] Establish that the retained raw sessions and their claimed independent source artifacts have incompatible terminal conclusions.
- [x] Obtain new independent PRIMARY and CHALLENGER reviews against the unchanged frozen binding and receiver boundary.
- [x] Rebuild v2 stage artifacts and provenance, then replace the rejected receipt/attestation with the current publisher.
- [x] Re-run deterministic replay and the complete final verification set.
