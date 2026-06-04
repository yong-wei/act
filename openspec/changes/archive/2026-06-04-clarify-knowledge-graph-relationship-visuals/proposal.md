## Why

The knowledge graph currently shows too many relations with similar line treatment, making the graph visually dense and hard to interpret. This is a UI design problem as much as a graph data problem.

This change makes knowledge graph relationship lines, filters, legends, and focus behavior clear enough for learning and exploration.

## What Changes

- Define relation visual semantics for prerequisite, contains, follows/leads-to, applies-to, opposite, and related edges.
- Reduce default edge density by showing skeleton and high-signal relations first.
- Add edge strength, relation filtering, hover/focus dimming, selected-neighborhood emphasis, and relation legend behavior.
- Preserve ResourceNode-aware graph exploration and existing graph browsing compatibility.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `resource-node-knowledge-workspace-ui`: add graph relationship visual clarity and density requirements.

## Impact

- Affects `/knowledge` graph presentation, relation styling, filtering controls, legend, and selected-node interaction.
- Depends on `define-premium-platform-ui-foundation`.
- Does not change ResourceNode ownership, course runtime, or graph source-of-truth semantics.
