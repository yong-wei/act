## Why

After a student selects a path and launches a node, the target interactive resource or course runtime behaves like a generic Interactive Learning page. The visible return control sends the student away from the selected path, making the path journey feel lost even when path state exists.

## What Changes

- Add a normalized path launch context for nodes opened from the adaptive path center.
- Pass source, goal id, path id, node id, route intent, return href, and resource type to target routes where supported.
- Update interactive resource and course runtime return controls to use path-specific language and return to the path execution workspace when a valid path context exists.
- Preserve existing non-path return behavior for resources opened from Interactive Learning, course entries, or other surfaces.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `adaptive-learning-center-ui`: require path-launched resources to return to the same adaptive path execution context.
- `adaptive-learning-path-planning`: require path execution launch context to be derived from authorized path state rather than ad hoc client hints.

## Impact

- Affects path node launch URL construction, resource route query/context parsing, interactive resource headers, course runtime return controls, and tests for path vs non-path launch behavior.
- Does not implement completion write-back or latest-path resume; those remain separate series changes.
