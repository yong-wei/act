## 1. Layout State Boundary

- [ ] 1.1 Inventory where graph nodes and links are cloned, laid out, or replaced during `/knowledge` rendering.
- [ ] 1.2 Add a stable node reconciliation path keyed by node id.
- [ ] 1.3 Store user-positioned node coordinates and pin state by id.
- [ ] 1.4 Gate automatic relayout behind first load, filter/data replacement, or explicit user action.

## 2. Hover And Selection Separation

- [ ] 2.1 Split hover preview state from graph focus/filter state.
- [ ] 2.2 Ensure hover shows node name and compact metadata without changing filtered nodes, filtered links, or layout version.
- [ ] 2.3 Ensure node click updates selected node and inspector state without recreating graph objects or reheating layout.
- [ ] 2.4 Remove full-panel remount behavior that resets inspector content solely because selection changed.

## 3. Drag And Layout Controls

- [ ] 3.1 Persist dragged node coordinates after drag end.
- [ ] 3.2 Preserve dragged coordinates after hover, selection, inspector open/close, and density changes when the node remains visible.
- [ ] 3.3 Add explicit controls for fit view, relayout, pin/unpin, and clear pins where appropriate.

## 4. Verification

- [ ] 4.1 Add tests proving hover, including high-frequency hover changes, does not change graph data identity, filtered graph membership, or layout version.
- [ ] 4.2 Add tests proving selection and inspector open/close do not reset layout coordinates.
- [ ] 4.3 Add tests proving dragged node coordinates survive selection and hover changes.
- [ ] 4.4 Capture browser evidence for hover preview, click selection, drag persistence, explicit relayout, and no visible jitter.
- [ ] 4.5 Run `rtk openspec validate stabilize-knowledge-graph-interaction-state --strict`.
