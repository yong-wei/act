## Why

After primary resource-family batches, any remaining missing semantic-review or disposition findings must be closed before the final gate can assert all existing resources are accounted for.

## What Changes

- Run the helper after upstream resource-family batches and isolate all remaining missing semantic-review, missing disposition, invalid promotion, unmatched projection, or unexplained exclusion findings.
- Review residual knowledge cards, infographs, registered resources, quiz/exercise/homework resources, slides, video/audio, image descriptions, miscellaneous runtime projections, and any cross-family leftovers.
- Produce a final before/after helper summary for downstream evidence-lineage and full-readiness gate changes.

## Impact

- Adds a staged resource-completion batch under `resource-path-readiness`.
- Requires helper before/after evidence and independent review before downstream gates can rely on the result.
- May update resource governance data, helper output, tests, and spec deltas within this change boundary.
