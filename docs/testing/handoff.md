# Test command contract handoff

Inputs for `eliminate-accepted-red-test-baseline`,
`split-production-tooling-test-typescript-graphs`, and CI gates.

## Current revision-bound observation

- sourceCommit: `5ee65d52343029756a09a2ad0ba50504fb4f9557`
- sourceTree: `03f832624c9ec800ff76702cdd4af1927946f895`
- observedAt: `2026-08-27T04:01:00+08:00`
- worktree: dirty; the source identity above is the current `HEAD`, not a
  qualified clean-tree receipt
- direct Vitest unit scope: 805 files passed, 0 failed; 9,753 tests passed,
  0 failed, 0 skipped; 0 unhandled errors
- accepted failure count: 0
- `test:unit` wrapper is not yet qualified because the worktree is dirty

The complete revision-bound inventory is in
`docs/testing/baseline/failure-inventory.json`. Counts in that file describe
only the command and revision recorded there.

## Closed in this work package

- Konling derived-path persistence uses a destination-legal test registry and
  remains in the unit lane.
- Assessment remediation unavailable-attribution now exports
  `REMEDIATION_MANUAL_PRACTICE_PATH` from the orchestration mock.
- ActKG public-bundle fixture cleanup retries `ENOTEMPTY` from Git object
  directories instead of treating the cleanup as a test failure.
- Capture-bound v0.18/v0.22 prepare, textbook canonical index, upstream Bundle
  v2, and production DB-fallback checks live in `*.real-smoke.test.ts` files.
  Discovery classifies them as nightly; they no longer decide `test:unit`.

## Gate status

- Direct unit execution in this dirty tree is green and has no accepted
  failure, unhandled error, or unregistered skip.
- `npm run test:unit` and `npm test` wrappers fail closed on a dirty worktree
  and cannot mint a HEAD-bound receipt until this change is committed.
- `test:release` requires `qualification-manifest` and fails closed when it is
  absent. This is a release blocker, not a product-test skip. The missing-input
  contract is covered in `test-command-contracts.test.ts`.
- No production selector, destination contract, or release activation was
  changed.

See `docs/testing/command-contracts.md` for scope rules and
`docs/testing/failure-dispositions.md` for the four permitted dispositions.
