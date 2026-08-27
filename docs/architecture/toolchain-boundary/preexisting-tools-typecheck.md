# Pre-existing tools and test graph typecheck failures

`npm run typecheck:tools` is the independent tools graph command. On source
`3eec9726d` it is blocked by pre-existing `tsc-type-errors` in scripts outside
this change, including `scripts/analysis`, `scripts/course-coverage`,
`scripts/data-governance`, and `scripts/db`. Those failures are recorded as
tools-graph debt, not as production typecheck results, and are not hidden by
`typecheck:web` / `typecheck`.

`npm run typecheck:test` is the independent test graph command. On the same
source it is blocked by a pre-existing `tsc-process-failure` (`exit:134`),
typically an out-of-memory abort of the test-graph `tsc` process. That
receipt stays a test-graph failure and is not relabeled as a production pass.

This boundary change maps tool classes to `typecheck:tools` / `typecheck:test`
and does not expand the production graph or skip those errors.
