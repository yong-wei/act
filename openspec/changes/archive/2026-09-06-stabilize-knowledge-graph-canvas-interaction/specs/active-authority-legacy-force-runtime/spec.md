## MODIFIED Requirements

### Requirement: Filter changes preserve force session state
Enabling or disabling any active node type or relation family SHALL preserve coordinates, user pins, force-settlement state, camera, selection, loaded shards and inspector state for every still-visible identity. Filter-only changes MUST NOT restart the entire simulation. Render-only state changes — hover, selection, preview浮层、主题或 locale 切换——MUST NOT invalidate the engine payload identity: while the structural signature (node identity set, link endpoint set, graph version, relayout version) is unchanged, the renderer SHALL reuse the previous engine payload and MUST NOT re-ingest data into the force simulation.

#### Scenario: Viewer toggles one relation family
- **WHEN** one loaded engineering family is hidden and restored
- **THEN** only that family's visible edges SHALL change
- **AND** node coordinates, camera and selected detail SHALL remain stable

#### Scenario: Viewer enables an unloaded family
- **WHEN** the panel requests a missing family shard
- **THEN** the runtime SHALL keep the current graph usable while the bounded shard loads
- **AND** only the affected scope MAY reheat after verified nodes and edges arrive

#### Scenario: Hover does not reheat the engine
- **WHEN** the pointer enters, rests on, or leaves any node of a settled graph
- **THEN** the engine payload reference SHALL remain identical and the simulation SHALL NOT be re-ingested or reheated
- **AND** every other node's coordinates SHALL remain fixed, with only the hovered node's glyph and preview presentation changing

#### Scenario: Selection and preview re-renders keep the payload
- **WHEN** selection, hover preview or other render-only state changes re-render the canvas container
- **THEN** default-valued and derived payload inputs SHALL be referentially stable (memoized or module-constant)
- **AND** the force simulation SHALL keep its settled coordinates without drift
