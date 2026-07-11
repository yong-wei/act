## 1. Expandability Contract

- [x] 1.1 Add a versioned expandable, leaf, or unknown descriptor and optional revealable-neighbor count to progressive knowledge-node payload types.
- [x] 1.2 Compute expansion descriptors from canonical graph relations for root, expansion, active-filter, and remaining payload builders without exposing or loading the full graph in the browser.
- [x] 1.3 Update graph fixtures, cache merge behavior, and unit tests for version changes, missing compatibility metadata, leaf nodes, and expandable nodes.

## 2. Direct Node Activation

- [x] 2.1 Replace the selected-node toggle closure with a node-id activation resolver covering collapsed, expanded, filtered-empty, leaf, unknown, loading, error, retry, and filter-recovery states.
- [x] 2.2 Route 2D/3D nodes, directory, search, deep links, and inspector Related Knowledge Points through the resolver, closing the inspector for expandable nodes and opening or replacing it only for canonically resolved leaf nodes.
- [x] 2.3 Add a synchronized semantic node-control path so keyboard Enter and Space produce the same activation outcomes with accessible focus, busy, expanded, leaf, and error states.
- [x] 2.4 Remove the node-following expansion button, positioning/focus machinery, and bottom-left expansion instruction panel after direct activation parity is verified.

## 3. Stable Sector Layout

- [x] 3.1 Replace complete-ring focused placement with deterministic outward-sector selection using activation-sequence-ordered first-reveal provenance, canonical revealable-neighbor rules, bounded occupied-space scoring, stable center-id tie-breaks, and additional arcs for large neighborhoods.
- [x] 3.2 Preserve all already visible, user-positioned, and unrelated coordinates; assign automatic fixed coordinates only to newly materialized nodes and reveal relations to existing children without relocating them.
- [x] 3.3 Freeze established 2D and 3D coordinates after the initial layout pass and prevent node dragging from reheating the graph or modifying any node except the dragged node.
- [x] 3.4 Keep explicit reset and relayout commands functional and add unit tests for deterministic sectors, reversed network-response order, overlapping provenance claims, dense fallback sectors, multiple arcs, existing-neighbor preservation, pins, and drag isolation.

## 4. Motion And Inspector Behavior

- [ ] 4.1 Add bounded focus dimming, center-to-neighbor relation reveal, staged node appearance capped at 24 individually staggered nodes, batched large-shard fallback, collapse transition, safe local viewport translation, and stale-transition cancellation without new continuous motion or full-graph fit-to-view.
- [ ] 4.2 Implement `prefers-reduced-motion` behavior that reaches the same final focus, loading, expanded, collapsed, and error states without required spatial interpolation, stagger, or animated semantic particles while retaining static direction grammar.
- [ ] 4.3 Close the inspector on blank-canvas activation, canvas drag start, node drag start, and expandable-node activation while preserving expanded neighborhoods, cache, viewport, and coordinates.
- [ ] 4.4 Reorder desktop and mobile inspector content so Knowledge Card precedes Related Knowledge Points, with learning-path and evidence actions following both sections.

## 5. Verification And Governance

- [ ] 5.1 Add component and integration tests for all activation entry points, duplicate suppression, canonical unknown resolution, filtered-empty recovery, retry, cache reuse, rapid expand/collapse and target switching, stale async cancellation, inspector dismissal, and inspector content order.
- [ ] 5.2 Add coordinate assertions proving initial-layout freeze, deterministic provenance and sector coordinates, bounded and cancellable local camera movement, and that only the dragged node changes throughout and after drag.
- [ ] 5.3 Capture timestamped browser evidence for expandable click, collapse, leaf inspector, blank and drag dismissal, sector expansion, multiple arcs, motion, and reduced motion in 2D/3D, light/dark, desktop/narrow, local-tool, inspector, and Konling collision states.
- [ ] 5.4 Run independent visual and accessibility review; reject complete-ring cross/star topology, global layout movement, perpetual motion, inaccessible node activation, incorrect inspector order, overlap, or canvas resizing as blocking issues.
- [ ] 5.5 Run focused unit and Playwright suites, `rtk npm run typecheck`, `rtk openspec validate redesign-knowledge-graph-direct-manipulation --type change --strict`, and the applicable knowledge-graph governance checks.
