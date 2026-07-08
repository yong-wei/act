## 1. Graph Payload Contract

- [ ] 1.1 Define graph version, shard key, node id, and link key contracts for root, expansion, active-filter, and remaining-graph payloads.
- [ ] 1.2 Add or update runtime graph helpers that can produce top-level chapter roots, expansion shards, active-filter shards, and remaining graph shards without requiring the client to fetch the full graph first.
- [ ] 1.3 Add API routes or route behavior equivalent to root graph, node expansion, active-filter shard, remaining shard, and graph manifest requests.
- [ ] 1.4 Keep the existing full graph endpoint only as a compatibility or diagnostics path, and make the first-render path independent from it.
- [ ] 1.5 Ensure dense/all-relation user flows use remaining graph shards, not the full graph endpoint.

## 2. Client Progressive Loading

- [ ] 2.1 Refactor `KnowledgeGraphSystem` state so graph cache is separate from visible expansion state.
- [ ] 2.2 Render first-screen collapsed root nodes from the root graph payload.
- [ ] 2.3 Add expand/collapse affordances for selected graph nodes, including local loading state for missing expansion data.
- [ ] 2.4 Implement shard-aware merge behavior using `nodesById`, `linksByKey`, `loadedShardKeys`, `loadingShardKeys`, `expandedNodeIds`, and `loadingExpansionNodeIds`.
- [ ] 2.5 Start active-filter background loading after root nodes are visible, then load remaining graph shards only after active-filter shards are cached.
- [ ] 2.6 Ensure filter changes request only missing shards and reuse already loaded graph data.

## 3. UX, Layout, and Integration

- [ ] 3.1 Preserve ResourceNode launch actions, selected-node inspector behavior, relation filters, graph legend, 2D/3D view switching, and Konling context.
- [ ] 3.2 Ensure background loading does not block panning, zooming, selection, local graph tools, or floating dock actions.
- [ ] 3.3 Preserve layout stability when shards arrive, nodes expand or collapse, and selected nodes update.
- [ ] 3.4 Provide filtered-empty and no-children states for expansions that have no visible descendants under the active filter.
- [ ] 3.5 Add keyboard and focus behavior for expand/collapse controls, including Enter/Space activation, accessible expanded/loading state, focus retention after async expansion, and no focus theft during background loading.
- [ ] 3.6 Preserve Konling citation relevance and answer citation-selection semantics; this change may preserve or pass through context but must not implement `konling-answer` relevance policy.

## 4. Tests and Evidence

- [ ] 4.1 Add unit tests for root payload generation, expansion shard generation, shard key stability, and graph version invalidation.
- [ ] 4.2 Add client or component tests proving first render does not request, parse, or depend on the full graph endpoint before root nodes are visible.
- [ ] 4.3 Add cache tests proving repeated expand/collapse and filter changes do not refetch loaded shards or duplicate node/link objects.
- [ ] 4.4 Add browser or Playwright evidence for `/knowledge` at 1440px, 1279px, 1100px, 1024px, and 320px: root first render, expansion loading, expanded state, collapsed state, background loading, dense mode, and filtered-empty expansion.
- [ ] 4.5 Update commercial UI governance fixtures or checks so progressive loading evidence is required for knowledge graph acceptance.
- [ ] 4.6 Add structured visual evidence for opened local tool, selected-node inspector, expanded Konling, floating dock, and expansion loading overlap; include focus-return, dock-avoidance, and selected-context retention fields.
- [ ] 4.7 Add dense-mode regression coverage proving dense/all-relation exploration uses remaining shards rather than the full graph endpoint.

## 5. Validation

- [ ] 5.1 Run focused knowledge graph unit tests.
- [ ] 5.2 Run relevant commercial UI governance tests for `/knowledge`.
- [ ] 5.3 Run `rtk openspec validate progressive-knowledge-graph-loading --strict`.
- [ ] 5.4 Run Buddy issue-body validation before creating the GitHub issue.
