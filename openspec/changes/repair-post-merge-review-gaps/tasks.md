## 1. Active Class Publication Scope

- [ ] 1.1 Require `isActive: true` when `publishAssignmentRevision` resolves administrator-selected classes, while preserving the teacher ownership predicate and existing publication-blocked error contract.
- [ ] 1.2 Verify an inactive administrator audience is rejected before revision freeze or audience creation, using the focused assignment-service regression case already present in the branch diff.

## 2. Portrait Materialization Transaction And Concurrency

- [ ] 2.1 Execute the portrait v2 snapshot read, incremental update, and write through one Prisma transaction and acquire a transaction-scoped per-student advisory lock before reading the prior snapshot; fail closed when the lock primitive is unavailable.
- [ ] 2.2 Verify fact ordering, cursor boundaries, context-only filtering, seven-dimension output, and the existing lightweight test adapter behavior remain unchanged while concurrent same-student materialization is serialized.

## 3. Submission Asset SHA-256 And Size Integrity

- [ ] 3.1 Carry the persisted asset checksum through authorized asset-read metadata and verify both byte length and SHA-256 digest after fetching object bytes and before returning the response.
- [ ] 3.2 Verify same-size tampering and size mismatches fail closed with `asset-integrity-mismatch`, without returning unverified bytes or changing the existing authorization and token-consumption flow.

## 4. Scoped Validation

- [ ] 4.1 Validate the proposal, design, tasks, and Buddy issue body locally with strict OpenSpec and issue-body validators available in this worktree.
- [ ] 4.2 Validate the three modified capability deltas and confirm no database schema or migration is part of this repair.
- [ ] 4.3 Confirm the final working-tree scope contains only this change's OpenSpec artifacts, the three original repair paths, and their focused regression tests; no skill, external repository, commit, push, GitHub operation, or other worktree was changed.
