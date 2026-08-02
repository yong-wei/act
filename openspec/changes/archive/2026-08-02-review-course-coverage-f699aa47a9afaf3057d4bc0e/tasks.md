## 1. Freeze the review input

- [x] Verify the `batches[23]` manifest slice, exact order, 265-member count, and all bound digests before any review.
- [x] Fail closed if a member, digest, canonical revision, or selected manifest file changes.

## 2. Produce independent conclusions

- [x] Primary reviews all 265 exact members against current course evidence and records member-specific rationales; five non-risk members are `INCLUDE` and the remaining 260 are role-free `DEFER`.
- [x] Challenger independently reviews all 224 profileOnly/highRisk members required by the manifest and records separate rationales; all 224 conclusions are role-free `DEFER`.
- [x] Preserve both raw stage sources byte-for-byte and bind normalized stage documents and provenance to source SHA-256 and writer sessions.
- [x] Confirm zero semantic conflicts and no Third stage; `thirdRequired=false` and no Third artifact is retained.
- [x] Record unfrozen semantic candidates as diagnostic only; require upstream `#1180` bind/classify/re-freeze before any later re-review.

## 3. Assemble the decision receipt

- [x] Emit a deterministic machine-mergeable receipt keyed by batchId and every binding digest.
- [x] Map the five Primary-only INCLUDE decisions and 260 agreed role-free DEFER decisions to the expected terminal outcomes; leave CourseCoverage authority unresolved and keep the aggregate gate blocked.
- [x] Prove the receipt contains no member outside the frozen ordered slice and no production selector/writer-fence mutation; publish v3 proof and v2 detached attestation.

## 4. Validate

- [x] Run strict OpenSpec validation for this change.
- [x] Run focused receipt/manifest checks, identical CLI replay, and `git diff --check`.
