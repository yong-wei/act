## Why

Students who choose a path can leave the path center and later return without seeing the selected path, its current node, or its completion effects. In addition, some path-launched interactive resources can complete locally without writing a governed path completion event, so the path cannot reliably advance.

## What Changes

- Restore the latest authorized active path as the default path center state when no explicit path deep link is supplied.
- Show a completed-path summary when the latest path is completed and there is no active path.
- Add completion write-back coverage for path-launched interactive resources that currently only complete locally.
- Keep dependent nodes blocked or pending when required path completion or typed outcome references have not been written.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `adaptive-learning-center-ui`: require active-path resume, completed-path summary, and durable visible completion effects.
- `adaptive-learning-path-planning`: require completion write-back and latest path recovery to use path persistence before generated defaults.

## Impact

- Affects `/assessment/adaptive-practice` initial state selection, `/api/learning-paths/latest` usage, path execution node status rendering, interactive resource completion bridges, and tests for active/completed path recovery.
- Relies on the launch context series change for full launched-resource E2E behavior, but path recovery and completion event semantics can be implemented and tested independently.
