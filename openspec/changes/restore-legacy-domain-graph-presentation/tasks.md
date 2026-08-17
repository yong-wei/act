## 1. Circular root entries

- [ ] 1.1 Add a presentation-only adapter from the active root shard's domain catalog (plus the aggregate entry) to the `KNOWLEDGE_ROOT_PACKING` input shape in `src/features/knowledge/graph/root-layout.ts`, without carrying any internal identity into layout metadata.
- [ ] 1.2 Replace the root card grid branch in `src/features/knowledge/active-authority-graph.tsx` with the ported circular bubble root: one circular entry per catalog domain plus one visually distinguished aggregate entry, using `KNOWLEDGE_ROOT_BUBBLE_STYLE` platform tokens.
- [ ] 1.3 Enforce zero inter-entry line geometry at the root and fail-closed human-facing labels (controlled unavailable state when a domain display name or summary is missing).
- [ ] 1.4 Add tests: entry count follows the active catalog (including counts other than eight), deterministic packing for the same catalog and viewport, no edge/connector elements at the root, no internal identifiers in root DOM text or accessible names.

## 2. Progressive domain and node loading

- [ ] 2.1 Wire circular entry activation to load only the activated domain's root shard and default published teaching relations, preserving the visible return path to the root level.
- [ ] 2.2 Load a selected node's adjacent relations and detail content on demand; keep engineering relation families behind explicit filters that fetch only their missing shard.
- [ ] 2.3 Keep Authority objects visible and selectable when teaching projection coverage is partial or empty, with honest disclosure and no inferred ordering.
- [ ] 2.4 Add tests: ordinary root and domain navigation never requests the complete Authority object or relation sets; teaching-default and filter behavior; non-blocking partial teaching coverage.

## 3. Legacy-style inspector on active data

- [ ] 3.1 Align the active node detail sidebar with the Legacy interaction contract: stable placement, in-place update on reselection, explicit close with focus return, unchanged domain/filter/layout state.
- [ ] 3.2 Confirm inspector content (name, type label, explanation, relation summary, knowledge card, infograph) resolves from the active composite release and its ACT display projections, with existing fail-closed manifest and identity rules intact.
- [ ] 3.3 Add tests: reselection updates the panel in place, focus return on close, no internal identifiers in visible text, accessible names, tooltips, or copy payloads.

## 4. Validation and evidence

- [ ] 4.1 Run `npm run lint`, `npm test`, `npm run build`, and `openspec validate restore-legacy-domain-graph-presentation --type change --strict`; fix in-scope failures.
- [ ] 4.2 Capture `/knowledge` in Playwright (desktop and mobile, light and dark): circular root with no lines, domain entry transition, node selection with sidebar, and console free of errors.
- [ ] 4.3 Verify the v0.9 read-only history entry still works and that normal graph reads never touch v0.9 data.
