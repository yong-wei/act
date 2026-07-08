## Why

The knowledge graph currently waits for the client to fetch and parse the full graph before nodes appear. The current runtime graph has 820 nodes and 16,545 relations; even the default filtered view still derives from the full payload, so remote first load feels blocked by network transfer, JSON parsing, and graph layout work.

## What Changes

- Change `/knowledge` first paint from a full-graph load to a collapsed root graph load.
- Show only top-level graph nodes on first render; for the current runtime data these should be the stable chapter-level roots rather than inferred concept roots.
- Add explicit expand/collapse behavior on graph nodes:
  - collapsed nodes expose an expand action after selection,
  - expanded nodes expose a collapse action after selection,
  - collapsing hides descendants but does not evict cached data.
- Add progressive graph loading:
  - batch 1: first-screen top-level roots,
  - batch 2: background load of the graph matching the active default filter,
  - batch 3: background load of the remaining graph for dense or all-relation exploration.
- Add shard-aware client caching so nodes, links, and graph shards already loaded are not requested, parsed, or merged again.
- Add loading states for expansion requests that need a shard not yet available.
- Keep ResourceNode launch, selected-node inspector, local tools, relation filters, Konling context, and graph layout stability intact.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `resource-node-knowledge-workspace-ui`: Require collapsed root-first graph loading, node expansion/collapse, background graph batches, and shard-aware cache behavior.
- `commercial-ui-governance-gates`: Require current visual and performance evidence proving `/knowledge` does not block first render on a full graph payload and that expansion/loading states are usable.

## Impact

- Affected UI: `src/features/knowledge/knowledge-graph-system.tsx`, graph renderers, local graph tools, node inspector, and graph loading state.
- Affected APIs/data: `/api/knowledge/graph` behavior, new or replacement graph root/expand/shard endpoints, runtime graph payload generation, cache headers, and graph version metadata.
- Affected tests: knowledge graph route/API tests, resource-node knowledge workspace UI tests, commercial UI governance checks, graph interaction stability checks, and browser/visual evidence for `/knowledge`.
- No database migration is required by the proposal; implementation may use generated runtime artifacts or existing graph tables as long as the public loading contract is satisfied.
