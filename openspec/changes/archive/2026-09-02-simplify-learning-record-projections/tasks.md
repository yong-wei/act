## 1. Confirm the prerequisite and freeze behavior

- [x] 1.1 Verify that `separate-online-learning-record-from-backfill-tools` is complete and its online/backfill operation contract is unchanged.
- [x] 1.2 Capture a clean before snapshot of online projection/read-model callers, current-pointer writers, caches, fallbacks and legacy aggregators.
- [x] 1.3 Add or confirm characterization fixtures for qualified, known-zero, missing, partial, stale, unavailable, privacy, small-sample, revision and watermark/pointer-fence states.

## 2. Apply the code-simplification pass

- [x] 2.1 Invoke the code-simplification skill and inspect each candidate's callers, callees, edge cases, git blame, compatibility role and tests before editing.
- [x] 2.2 Simplify one equivalent online projection/read-model orchestration at a time; preserve role-safe ports and never import backfill/runtime operations.
- [x] 2.3 Run direct regression tests after each change and compare before/after output, error, digest, scope, privacy fields, status, watermark and pointer behavior.
- [x] 2.4 Reject or defer candidates whose behavior, authority, operation contract, retention or rollback semantics are not proven equivalent.

## 3. Delete only obsolete online paths

- [x] 3.1 Prove zero required callers for duplicate page aggregators, legacy fallbacks, wrappers or cache authorities with static and dynamic canaries.
- [x] 3.2 Delete only the proven obsolete online code and imports/tests made unreachable by this change; retain legitimate downstream caches and all A backfill tools.
- [x] 3.3 Re-run architecture/dependency evidence and confirm complexity decreases without a new projection authority or allowlist.

## 4. Verify final behavior

- [x] 4.1 Run projection, consumer, role/privacy, small-sample, pointer-fence, PostgreSQL and route regression tests.
- [x] 4.2 Run `rtk npm run typecheck`, `rtk openspec validate simplify-learning-record-projections --type change --strict`, `rtk openspec validate --changes --strict` and `rtk git diff --check`.
- [x] 4.3 Record before/after evidence and final deletion set; confirm A's command/worker/permission/receipt contract is byte-for-byte unchanged.
