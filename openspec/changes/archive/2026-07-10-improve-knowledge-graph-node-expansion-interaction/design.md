## Design Notes

Current evidence from the codebase:

- `KnowledgeGraphSystem` owns the expansion state and currently renders the
  selected-node expansion panel as an absolute bottom-left surface.
- `handleToggleSelectedExpansion` already centralizes expansion and collapse,
  including shard loading, loading state, and empty-result state.
- `KnowledgeGraph2D` renders nodes through `nodeCanvasObject` and exposes
  `graph2ScreenCoords` internally, so a node-following DOM button can be
  positioned without changing the graph data model.
- `KnowledgeGraphCanvas` has a parallel 3D rendering path and should not be
  left with a different expansion interaction.
- `layout-engine.ts` currently places chapter members around chapter nodes and
  then lets force simulation continue to move them; this can create a stretched
  fan instead of a centered local expansion.

## Proposed Shape

### Node-local expansion control

The primary control should be a real DOM button overlaid on the graph canvas.
It should be positioned from the selected node's screen coordinates and clamped
inside the graph viewport. The button should use the existing expansion state:

- collapsed: `展开`
- loading: `加载中`
- expanded: `收起`
- unavailable or no visible expansion: hidden or disabled with an honest reason

The bottom-left panel can remain as context/status text, but it should not be
the only way to expand or collapse.

Canvas-only painted controls are not preferred because they make keyboard
focus, screen-reader labels, hit targets, and loading state harder to govern.

### Focused expansion layout

When a node is expanded, its direct expansion children should be laid out using
the expanded node as the local center:

- center node remains visually central to its child cluster
- first ring contains the most important or first direct children
- additional children spill into stable additional rings
- angles are deterministic so repeated expand/collapse does not shuffle nodes
- expanded child links remain visible even when relation density filters would
  otherwise hide weaker edges
- user-pinned coordinates override automatic focused-expansion positions

The implementation may add a focused-expansion layout helper rather than
rewriting the entire graph layout. The helper should receive expanded node ids,
direct expansion links, selected node id, current layout state, and existing
node metadata.

### Stability rules

Selection, opening the node-local button, loading an expansion shard, and
collapsing a node must not reset unrelated node positions or call fit-to-view
without an explicit user action. If the implementation recenters the view after
an expansion, it should be a bounded local reveal, not a full graph zoom reset.

### Visual verification

This change is mostly interaction and layout quality, so acceptance should not
rely only on unit tests. It needs browser evidence showing:

- collapsed top-level unit selected with button near the node
- expanded top-level unit with children around that node as local center
- collapsed again with unrelated graph layout stable
- dark and light theme readability
- desktop and mobile or narrow viewport behavior
- no collision with local tool panels, the shared floating dock, or inspector

## Risks

- A node-following DOM overlay can drift if screen coordinates are not updated
  after zoom/pan/tick events. Mitigate by updating position on graph render,
  zoom, selection, and expansion state changes.
- Force simulation can still pull expanded child nodes into a fan. Mitigate by
  fixing or strongly anchoring focused expansion positions unless the user drags
  a node.
- 3D mode may need a simplified overlay behavior because projected node
  coordinates can change with camera movement. If full 3D parity is expensive,
  the implementation must either support projected node-local controls or keep
  a clearly documented fallback with visual evidence.
