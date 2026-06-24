## Why

The current knowledge graph does not communicate relationship semantics clearly: multiple relation types collapse into a visually noisy mesh, the legend is text-only, and filter labels still expose raw field names. A production teaching platform needs the graph to act as a readable conceptual map, not just a database visualization.

## What Changes

- Redesign the knowledge graph visual language for relation edges, node scale, node emphasis, labels, and legends.
- Require each relation family to use a distinct non-color visual encoding such as line pattern, arrow behavior, endpoint marker, curvature, opacity, and width.
- Require graph edges to render as fine lines by default, with emphasis coming from focus state instead of permanently thick strokes.
- Replace text-only relationship legends with graphical legend samples that match the actual rendered edge grammar.
- Localize graph filter labels and visible field names into Chinese learning language instead of raw schema keys such as `category` or `bloom_level`.
- Keep this change focused on graph expression; shell placement, panel collapse, and route-family navigation remain owned by related UI shell changes.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `resource-node-knowledge-workspace-ui`: define the readable visual grammar for knowledge graph nodes, edges, legends, and filter labels.

## Impact

- Affects `src/features/knowledge/knowledge-graph-system.tsx`, graph renderer components under `src/features/knowledge/graph/`, relation label helpers, and visual config.
- Adds or updates graph rendering tests, DOM evidence, and visual QA expectations for relation samples and localized labels.
- Does not change knowledge data models, ResourceNode business orchestration, or route shell ownership.
