## Why

`tsc --noEmit` reports 6 errors in Arena evidence writeback and leaderboard tests. These failures are isolated from the larger resource and Konling clusters: evidence writeback mocks infer `never`, and leaderboard fixtures still pass a stale `userId` field to `CreateArenaSubmissionInput`.

## What Changes

- Repair Arena evidence writeback test typing so mocked persistence results preserve the intended payload contract.
- Align leaderboard submission fixtures with the current `CreateArenaSubmissionInput` contract.
- Preserve official Arena score, validity, ranking, and submission authority.

## Impact

- Targets 6 current TypeScript errors in 2 Arena test files.
- Does not change Arena official evaluation semantics.
