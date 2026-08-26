# Test command contract handoff

Inputs for `split-production-tooling-test-typescript-graphs`,
`establish-architecture-fitness-budgets`, and
`enforce-pr-integration-quality-gates`.

## Qualified unit observation

- sourceCommit: `bc9b8d3000ee54e9edc23bae6d58bc9d818b2352`
- sourceTree: `625a83394c716e7cc65198f10130176ee4ee9ac7`
- observedAt: `2026-08-27T04:06:00+08:00`
- worktree: clean, not mixed
- `test:unit` receipt `7bf33b8335e4d1f5a2faf39eb3da19e8daf38589f7ae1034153ba086667ff42d`
- `npm test` receipt `ac8c9209985abd1142ad85207a0230d720333771269480e2a6cfc8072916ce53`
- discovery: 1233 discovered / 1230 classified / 3 excluded / 0 unresolved
- discoveryCoreHash: `a4f2c498f20f96e6109a2221372d746686d2e5fdcbd59338cde68a9831a63b3e`
- accepted failure count: 0
- unhandled errors: 0
- unregistered skips: 0

The inventory is `docs/testing/baseline/failure-inventory.json`. Observation
counts describe only this command and revision.

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
- No production selector, destination contract, or release activation was
  changed.

See `docs/testing/command-contracts.md` for scope rules and
`docs/testing/failure-dispositions.md` for the four permitted dispositions.
