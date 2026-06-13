## Why

Even with better styling, the knowledge graph will remain unusable if layout density produces a tangled mass of nodes and edges. The graph needs an explicit clarity model that reduces default edge noise, sizes nodes meaningfully, and reveals conceptual structure through focus and clustering.

## What Changes

- Add graph clarity behavior for default density, node distribution, edge visibility, selected-neighborhood focus, and label visibility.
- Require the default view to prioritize high-signal conceptual structure and hide or fade weak relations until requested.
- Require node size and label behavior to adapt to importance and connection count without producing overlap.
- Require automatic layout acceptance checks for readability metrics such as visible edge count, overlap bounds, selected-neighborhood clarity, and zoom/focus recoverability.
- Depend on `redesign-knowledge-graph-visual-language` for the visual grammar used by the layout.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `resource-node-knowledge-workspace-ui`: define graph layout clarity, density, focus, and readability requirements.

## Impact

- Affects graph layout and filtering code in `src/features/knowledge/knowledge-graph-system.tsx` and graph renderer utilities.
- May add pure graph-metric helpers for degree, importance score, density mode, and overlap/readability checks.
- Does not change knowledge graph data generation, ResourceNode mapping, or route shell migration.
