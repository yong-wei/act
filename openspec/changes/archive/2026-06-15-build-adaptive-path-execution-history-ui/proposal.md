## Why

The accepted design requires students to see complete paths, current node, progress statistics, skip consequences, and history/evidence records. Current adaptive surfaces emphasize current recommendations and diagnostics, not a full path execution and evidence timeline.

## What Changes

- Build current-path execution UI using `concepts/03-active-path-execution.png` as the primary visual source.
- Build path completion, history, and evidence record UI using `concepts/04-history-evidence-record.png`.
- Show full route, current node, resource type icons, elapsed time, remaining time, total time, completed nodes, checkpoint pass state, and weekly learning.
- Allow completed nodes to be reviewed and continued, with new interactions entering data governance without double-counting first completion.
- Require explicit warning before skipping unfinished resources and record skip as path deviation.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `adaptive-learning-center-ui`: add full path execution, node detail, skip, history, and evidence record surfaces.
- `adaptive-learning-path-planning`: require execution/history state to distinguish completion, continuation, review, skip, return, and checkpoint outcomes.
- `commercial-ui-governance-gates`: require visual QA against the accepted execution/history concepts.

## Impact

- Affects adaptive center UI, path execution events, evidence summaries, route returns from launched resources, and visual evidence artifacts.
- Depends on generic path persistence and governed resource node semantics.
- Does not implement planner generation or Konling generation tools.
