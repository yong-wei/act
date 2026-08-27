# Test command contract handoff

Inputs for `split-production-tooling-test-typescript-graphs`,
`establish-architecture-fitness-budgets`, and
`enforce-pr-integration-quality-gates`.

## Qualified unit observation

- sourceCommit: `49117482cdda904ac0fde0ba33c93c82fe45d48d`
- sourceTree: `2614e8ae6eb6c84f08f156d8f90f69c5a105a4f3`
- observedAt: `2026-08-27T04:25:00+08:00`
- worktree: clean, not mixed
- `test:unit` receipt `5ac6378629e30a988645f601727f19b74c5cf4b7bb8384aefa3e14ceb96e56f1`
- `npm test` receipt `7533baefc0ad4729d7a682a1ea8b20dfd7d505d58b92caeb10ebc83e217812c3`
- discovery: 1233 discovered / 1230 classified / 3 excluded / 0 unresolved
- discoveryCoreHash: `5531b98699f0dafb75aae48ad49ad6216a3bebf99de43e3f1a011c76e0dc4137`
- accepted failure count: 0
- unhandled errors: 0
- unregistered skips: 0

The inventory is `docs/testing/baseline/failure-inventory.json`. Observation
counts describe only the measurement checkpoint above. A later generated docs
commit may follow that checkpoint as an ancestor; it does not reuse the
receipt for an unrelated tree.

## Closed in this work package

- Konling derived-path persistence uses a destination-legal test registry and
  remains in the unit lane.
- Assessment remediation unavailable-attribution exports
  `REMEDIATION_MANUAL_PRACTICE_PATH` from the orchestration mock.
- ActKG public-bundle fixture cleanup retries `ENOTEMPTY` from Git object
  directories.
- Capture-bound v0.18/v0.22 prepare, textbook canonical index, upstream Bundle
  v2, and production DB-fallback checks live in `*.real-smoke.test.ts`.
  Discovery classifies them as nightly; they no longer decide `test:unit`.

## Gate status

- `test:unit` and `npm test` wrappers passed on this clean HEAD.
- `test:release` failed closed with `release-manifest-missing`. That is a
  release blocker, not a product-test skip.
- `*.real-smoke.test.ts` files are classified nightly. `test:nightly` still
  fail-closes as `nightly-execution-not-run`; executing those files is a
  follow-up for `enforce-pr-integration-quality-gates`, not a product-test skip.
- No production selector, destination contract, or release activation was
  changed.

See `docs/testing/command-contracts.md` for scope rules and
`docs/testing/failure-dispositions.md` for the four permitted dispositions.
