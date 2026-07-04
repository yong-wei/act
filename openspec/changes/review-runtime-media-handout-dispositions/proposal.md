## Why

The helper reports many runtime media and handout resources as citation-ready but lacking human review, path profile, evidence contract, or parent PlanningUnit relationships.

## What Changes

- Review 904 runtime lesson media and 36 handout projections by lesson family and source hash.
- Define transcript/anchor needs for audio/video and page/figure anchors for slides/PDFs.
- Separate independent teaching resources from embedded assets and citation-only media.

## Impact

- Adds a staged resource-completion batch under `resource-path-readiness`.
- Requires helper before/after evidence and independent review before downstream gates can rely on the result.
- May update resource governance data, helper output, tests, and spec deltas within this change boundary.
