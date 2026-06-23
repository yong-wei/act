## Why

Graph Center now has read-only exploration, resource coverage, and overlay modes. After first-class LearningGoals and graph-driven planner inputs exist, the graph should become the visible action surface for students and teachers. If Graph Center remains only a visualization, users still have to leave the graph to find paths, resources, evidence, diagnosis, or prep-pack actions.

This change turns Graph Center into an actionable entry point while keeping graph body editing out of scope.

## What Changes

- Add graph-node actions for student path entry, resource exploration, citation inspection, and evidence review.
- Add teacher actions for class weak-node diagnosis, resource coverage gaps, and prep-pack generation entry.
- Add admin/teacher diagnostics for resource binding, citation readiness, and overlay limitations.
- Preserve read-only graph catalog semantics; actions operate on overlays, ResourceNodes, paths, and diagnosis services.
- Preserve accessible list/detail fallback and mobile drawer behavior.

## Capabilities

### New Capabilities

- `graph-center-action-surface`: Defines allowed actions from Graph Center node, goal, overlay, and resource-coverage states.

### Modified Capabilities

- `graph-center-ui`: Extends read-only exploration with role-scoped action entry points and actionable degraded states.
- `learner-graph-overlays`: Overlay recommendations become navigable actions where authorized.
- `graph-resource-coverage-overlay`: Coverage gaps can route to resource diagnostics or prep-pack actions without copying source content.

## Impact

- Affected areas: `src/features/graph-center/*`, `src/lib/data-governance/graph-center.ts`, `src/lib/data-governance/graph-center-sources.ts`, route ledger/action targets, and Playwright coverage.
- Depends on #640, goal subgraph expansion, learner/class overlays, resource coverage overlay, ResourceNode registry, and graph-driven path planner inputs.
- Does not add graph editing, objective editing, or raw evidence access.
