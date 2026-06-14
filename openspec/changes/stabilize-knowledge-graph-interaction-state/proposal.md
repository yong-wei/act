## Why

The current knowledge graph uses hover and selection as inputs to graph filtering and layout derivation, so simple pointer movement or node selection can rebuild graph data and create visible jitter. A learning map must let users inspect and drag nodes without fighting automatic relayout.

## What Changes

- Separate graph data/layout state from transient hover, selection, and inspector state.
- Make node hover a lightweight name preview and emphasis state, not a filter or relayout trigger.
- Make node click update selected context and inspector without recreating node objects, reheating layout, or fitting the camera.
- Persist user-dragged node coordinates by node id until explicit relayout, reset, or filter/data replacement.
- Add tests and browser evidence proving hover, click, drawer open/close, and drag do not cause unintended relayout.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `resource-node-knowledge-workspace-ui`: define stable interaction and layout contracts for the knowledge graph.
- `commercial-ui-governance-gates`: require interaction stability evidence for the knowledge graph.

## Impact

- Affects `src/features/knowledge/knowledge-graph-system.tsx`, graph renderer components, layout helpers, resource panel state, and graph tests.
- Does not change canonical knowledge graph content, relation taxonomy, or ResourceNode launch semantics.
