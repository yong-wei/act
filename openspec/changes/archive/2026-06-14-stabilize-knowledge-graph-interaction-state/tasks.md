## 1. Layout State Boundary

- [x] 1.1 Inventory where graph nodes and links are cloned, laid out, or replaced during `/knowledge` rendering.
- [x] 1.2 Add a stable node reconciliation path keyed by node id.
- [x] 1.3 Store user-positioned node coordinates and pin state by id.
- [x] 1.4 Gate automatic relayout behind first load, filter/data replacement, or explicit user action.

## 2. Hover And Selection Separation

- [x] 2.1 Split hover preview state from graph focus/filter state.
- [x] 2.2 Ensure hover shows node name and compact metadata without changing filtered nodes, filtered links, or layout version.
- [x] 2.3 Ensure node click updates selected node and inspector state without recreating graph objects or reheating layout.
- [x] 2.4 Remove full-panel remount behavior that resets inspector content solely because selection changed.

## 3. Drag And Layout Controls

- [x] 3.1 Persist dragged node coordinates after drag end.
- [x] 3.2 Preserve dragged coordinates after hover, selection, inspector open/close, and density changes when the node remains visible.
- [x] 3.3 Add explicit controls for fit view, relayout, pin/unpin, and clear pins where appropriate.

## 4. Verification

- [x] 4.1 Add tests proving hover, including high-frequency hover changes, does not change graph data identity, filtered graph membership, or layout version.
- [x] 4.2 Add tests proving selection and inspector open/close do not reset layout coordinates.
- [x] 4.3 Add tests proving dragged node coordinates survive selection and hover changes.
- [x] 4.4 Capture browser evidence for hover preview, click selection, drag persistence, explicit relayout, and no visible jitter.
- [x] 4.5 Run `rtk openspec validate stabilize-knowledge-graph-interaction-state --strict`.
