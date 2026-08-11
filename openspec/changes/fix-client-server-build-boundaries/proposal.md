## Why

Production builds currently fail because browser-reachable modules import Node-only
APIs through shared assignment and layered-graph modules. The failures block
unrelated pages and prevent scoped feature PRs from completing their required
build verification.

## What Changes

- Separate assignment validation contracts from server-only object integrity
  helpers so student assignment components do not bundle `node:crypto`.
- Separate client-safe layered-graph scope and drawer utilities from server-side
  Authority and Teaching Projection resolution so interactive lesson clients do
  not bundle `node:fs` or `node:path`.
- Add regression coverage that prevents browser-facing import paths from
  reintroducing Node-only modules.
- Restore successful Webpack and default production build gates without changing
  assignment, graph, or lesson user-facing behavior.

## Capabilities

### New Capabilities

- `client-server-build-boundaries`: Browser-reachable modules remain free of
  Node-only runtime imports while preserving existing server behavior.

### Modified Capabilities

- None.

## Impact

- `src/lib/assignments/*` and the student assignment workspace import boundary.
- `src/lib/layered-graph/*` and interactive lesson client entry points.
- Build verification and focused assignment/layered-graph regressions.
