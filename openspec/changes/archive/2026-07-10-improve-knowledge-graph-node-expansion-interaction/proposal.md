## Why

The knowledge graph currently places the selected-node expand/collapse action
in a fixed bottom-left panel. When a user selects a top-level unit node on the
canvas, the action appears far away from the selected object, so users must
visually search for the next step.

The expanded subgraph also does not preserve a clear local center. Child nodes
can appear as a slanted fan pulled by the parent position and force simulation,
which makes the unit expansion look like a bundle of edges rather than a local
concept map.

## What Changes

- Move the primary expand/collapse affordance to the selected graph node
  location, with a real accessible button that follows the node.
- Keep the existing bottom-left selected-node panel only as a status/fallback
  surface, not the primary expansion control.
- Add a focused expansion layout so direct children of an expanded node arrange
  around that node as the local center.
- Preserve user-pinned node positions and avoid unrelated graph relayout when
  selecting, expanding, or collapsing a node.
- Add visual and interaction validation for 2D and 3D graph modes, desktop and
  mobile where practical.

## Impact

- Affects `/knowledge` graph interaction and layout behavior.
- Expected code areas:
  - `src/features/knowledge/knowledge-graph-system.tsx`
  - `src/features/knowledge/graph/knowledge-graph-2d.tsx`
  - `src/features/knowledge/graph/knowledge-graph-canvas.tsx`
  - `src/features/knowledge/graph/layout-engine.ts`
  - visual QA or Playwright capture scripts/tests for the knowledge route
- Does not change graph data loading, ResourceNode semantics, path planning,
  Konling citation behavior, or resource registry data.
