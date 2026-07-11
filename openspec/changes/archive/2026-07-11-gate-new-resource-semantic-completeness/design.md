## Design Notes

The gate should evaluate the delta between the current working tree and the configured base branch, then identify new or modified resource records in supported registries and runtime projections.

For a resource to pass, it must either:

- have reviewed metadata sufficient for its intended path-planning disposition, or
- be explicitly classified as supporting-citation, embedded-asset, evidence-producing, or excluded-with-rationale with review metadata and source/version evidence.

The gate may use helper output and baseline files to avoid failing on existing historical gaps. It must fail on new gaps introduced after the baseline.

The implementation should integrate with the worktree sync script that installs local hooks, and also expose a direct command suitable for future CI reactivation.

## Verification Strategy

- Fixture test: incomplete newly added registered resource fails.
- Fixture test: complete path-plannable resource passes.
- Fixture test: complete supporting-citation or excluded-with-rationale resource passes.
- Hook/sync test: the worktree sync script installs or updates the local gate.
