## Context

`/knowledge` currently mounts `KnowledgeGraphSystem` without initial graph data and then fetches `/api/knowledge/graph` from the client. That API is dynamic and returns the full graph. Filtering, edge-density reduction, chapter-node injection, and renderer mounting happen after the full response arrives.

Current runtime evidence from `course-content/runtime/knowledge/graph/*`:

- full graph: 820 nodes and 16,545 relations,
- current default filtered display: about 597 display nodes and 1,291 display links after chapter injection,
- stable chapter roots: 15 top-level chapter nodes,
- chapter-root payload is below 1KB gzip in the current runtime data.

The right fix is not only compression. The graph should first render a useful collapsed overview, then load progressively according to user intent and active filters.

## Design Goals

- First visible graph state must not wait for full graph transfer.
- First visible graph state must be meaningful and stable, not an empty spinner.
- Loading should be demand-driven when the user expands nodes and opportunistic in the background when idle.
- The client must merge graph data by stable ids and never re-request or re-parse already loaded shards.
- Dense/all-relation exploration remains available, but it is not part of first paint.
- Existing knowledge workspace contracts remain intact: ResourceNode-aware actions, selected-node inspector, relation filters, graph layout stability, and Konling context must continue to work.

## Runtime Loading Model

### Batch 1: root graph

The first request returns a small root graph. For the current data model, the roots should be virtual chapter nodes because chapter metadata is explicit and stable. Inferred concept roots from `contains` relations may be exposed after expanding a chapter, but they should not be the global first-screen source of truth.

The root payload should include:

- root node id, label, chapter metadata, root type, and count summaries,
- per-root expansion status,
- graph version,
- filter signature used for first-screen counts,
- no full child node bodies and no full graph relation list.

### Batch 2: active-filter graph

After first paint, the client starts background loading for the current active filter signature. With current defaults this is equivalent to:

- `densityMode=structure`,
- `minRelationStrength=0.8`,
- connected nodes only,
- default structural relation types.

This batch may be delivered by chapter shards, relation-family shards, or another deterministic shard key, but the client must treat it as a partial cache fill. It must not force all matching nodes to become visible at once. Visibility is controlled by expansion state.

### Batch 3: remaining graph

After the active-filter graph is cached, the client may load remaining relation families and dense graph shards in the background. These shards are used only when the user selects denser filters, all-relation mode, searches a node that is not already cached, or expands into an area that requires them.

User-facing dense or all-relation exploration must still use remaining graph shards. A full graph compatibility endpoint may exist only for diagnostics, maintenance, or manual tooling. It must not be part of the normal `/knowledge` interaction chain.

## Expansion Contract

Selecting a collapsed node shows an expand action. Selecting an expanded node shows a collapse action.

When expand is requested:

1. Determine required shard keys from the selected node, depth, active filter signature, and current graph version.
2. If all required shards are cached, update `expandedNodeIds` and reveal the child nodes/links immediately.
3. If any required shard is missing, mark the node as loading and request only the missing shards.
4. Merge returned nodes and links by stable ids.
5. Reveal the expansion after required shards arrive.

Expansion controls must be real controls with keyboard and accessibility semantics. Enter and Space should activate expand or collapse, selected-node controls should expose `aria-expanded`, loading expansions should expose `aria-busy` or equivalent status text, and asynchronous shard arrival must preserve focus on the initiating control or the selected-node panel. Background shard loading must not steal focus from graph tools, inspector controls, or Konling.

When collapse is requested:

- update visibility only,
- keep cached nodes and links,
- preserve selected node context when possible,
- do not delete loaded shard records.

## Client Cache Shape

The implementation should keep the graph cache separate from visible graph state:

- `nodesById`
- `linksByKey`
- `loadedShardKeys`
- `loadingShardKeys`
- `expandedNodeIds`
- `loadingExpansionNodeIds`
- `filterSignature`
- `graphVersion`

This separation prevents filter toggles, node selection, and expand/collapse actions from remounting graph data or rerunning layout unnecessarily.

## API Shape

Implementation may choose exact route names, but it must provide equivalent behavior:

- root graph request,
- node expansion request,
- active-filter shard request,
- remaining/dense shard request,
- manifest or metadata request exposing graph version and shard keys.

The old full graph endpoint may remain only for compatibility diagnostics or maintenance tooling. `/knowledge` first render must not request, parse, or depend on it before root nodes are visible, and normal dense/all-relation exploration must use remaining shards instead of the full endpoint.

## Caching

Graph roots and shards should be cacheable by graph version. Runtime graph data is generated content, so versioned shard URLs can use long-lived cache headers. Manifest or graph-version metadata can use short cache or revalidation.

Client-side cache may use memory first and Cache API or IndexedDB later. The required behavior is deterministic de-duplication in a single page session; durable offline caching can be deferred.

## Visual and Interaction Requirements

- Root nodes must communicate that they are collapsed and expandable.
- Loading an expansion must be local to the node being expanded, not a full-page loading state.
- Background loading must not block panning, zooming, node selection, resource-panel use, local tools, or Konling entry.
- Background loading and shard merging must not modify `konling-answer` relevance or citation-selection semantics; that active change remains owned by Source Pack/Konling citation governance.
- First render must remain useful on desktop and mobile.
- Layout stability requirements still apply: hover, selection, expand/collapse, and background shard arrival must not redistribute unrelated visible nodes unexpectedly.
- Browser evidence must cover 1440, 1279, 1100, 1024, and 320 pixel viewports; opened local tools, selected-node inspector, expanded Konling, and expansion loading must have non-overlap, focus-return, dock-avoidance, and selected-context evidence.
- If an expansion has no visible children under the active filter, the user must see a local empty or filtered-out explanation rather than a blank graph.

## Risks and Tradeoffs

- Chapter roots are stable but less semantically rich than inferred concept roots. This is acceptable for first paint because the first action is expansion into a chapter.
- Background batch loading can increase total requests. This is mitigated by shard cache keys and long-lived versioned cache headers.
- Expansion visibility can become confusing if filters hide expected children. The UI should show filtered counts and a local empty state when expansion has no children under the current filter.
- If implementation keeps the full endpoint, tests must prove normal `/knowledge` user flows do not call it before roots are visible and do not use it for dense mode.
