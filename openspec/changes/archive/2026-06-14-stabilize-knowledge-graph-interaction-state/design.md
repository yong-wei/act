## Context

The product design audit and code inspection found that `KnowledgeGraphSystem` uses `hoveredNode` and `selectedNode` inside `focusNodeId`, relation filtering, density filtering, and generated graph state. `KnowledgeGraph2D` and `KnowledgeGraphCanvas` also clone graph objects and apply layout coordinates. The result is visible motion when the user is only trying to inspect a node.

Existing archived changes cover graph readability, edge density, and visual grammar. This change is narrower: interaction stability and layout state ownership.

## Goals / Non-Goals

**Goals:**

- Keep graph object identity stable across hover, selection, and inspector state changes.
- Prevent hover from changing graph filters or layout.
- Preserve user-dragged node positions until an explicit relayout or reset.
- Provide explicit layout controls such as fit view, relayout, pin, and clear pins.

**Non-Goals:**

- Redesign relation colors, line styles, or localized labels.
- Change authoring/runtime knowledge graph data generation.
- Replace the graph library unless the current library cannot satisfy stability requirements.

## Decisions

### 1. Hover is preview state only

Hover should drive tooltip/name preview and optional low-cost style emphasis. It must not feed `focusNodeId`, density filtering, injected chapter nodes, or graph data derivation.

Alternative considered: keep hover as focus. That makes every pointer move a potential graph rebuild.

### 2. Selection is style and inspector state

Clicking a node opens or updates the inspector, updates selected styling, and may update URL state. It should not rebuild node objects, rerun radial layout, call fit-to-view, or reset dragged positions.

Alternative considered: use selection to recompute visible neighborhoods. That can remain a separate explicit focus mode, but it must not be the default click behavior.

### 3. Drag creates explicit layout state

Dragging a node should store its final coordinates by id and mark it pinned or user-positioned. Automatic layout is allowed on first load, filter/data changes, or explicit relayout only.

Alternative considered: let the force layout keep adapting after every drag. That removes user agency and causes the current unstable feel.

## Risks / Trade-offs

- Stable graph objects are more stateful than pure derived data. Mitigation: isolate reconciliation in a layout-state helper and test it with deterministic fixtures.
- Filter changes still need to update visible graph data. Mitigation: preserve pinned coordinates for nodes that remain visible.
- Hover styling needs to stay performant. Mitigation: use id-based transient state, throttling where needed, and renderer-level style updates instead of rebuilding graph arrays.

## Migration Plan

1. Add a graph layout state boundary that reconciles nodes by id and stores pinned coordinates.
2. Split hover preview state from selected/focused graph state.
3. Update renderer props so hover, selection, and inspector state affect styling only.
4. Add explicit fit, relayout, pin, unpin, and reset layout actions.
5. Add focused tests and browser evidence for click, hover, drag, filter, and inspector state transitions.

## Dependencies

- Uses visual grammar and readability contracts already archived in `redesign-knowledge-graph-visual-language` and `stabilize-knowledge-graph-layout-clarity`.
- Should run before final product QA so governance can measure stable behavior.
