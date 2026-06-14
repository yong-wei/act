## Why

Archived knowledge graph specs define relation grammar and readability, but the current product audit still shows a dense graph that reads as a tangled mass. This change owns the implementation-facing refinement that turns the graph into a semantic map aligned with the approved Product Design concepts.

## What Changes

- Refine node and edge presentation so relation lines are thin, subordinate, and visually distinct in both light and dark themes.
- Apply semantic cluster territory and hierarchy treatment inspired by `layered-research-atlas.png` without copying generated node positions.
- Ensure graphical relation legends and actual graph edge styles remain generated from the same visual contract.
- Make selected and focused neighborhoods clearer without making hover or selection trigger layout changes.
- Add evidence that the current graph moved from all-edge tangle toward a readable semantic map.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `resource-node-knowledge-workspace-ui`: refine knowledge graph semantic map presentation beyond the existing visual grammar baseline.
- `commercial-ui-governance-gates`: require current semantic-map presentation evidence, not only relation coverage tests.

## Impact

- Affects graph visual configuration, graph renderer styling, legend samples, theme tokens, and browser evidence.
- Builds on archived `redesign-knowledge-graph-visual-language` and `stabilize-knowledge-graph-layout-clarity`.
- Does not change relation taxonomy, course-content graph data, or graph interaction layout-state ownership.
