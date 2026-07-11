## Context

The current graph interaction is the result of the archived `improve-knowledge-graph-node-expansion-interaction` change. It introduced a node-following DOM expansion button and a focused layout helper that distributes direct expansion neighbors across complete deterministic rings. In the current implementation:

- `handleNodeClick` always selects the node and opens the inspector; expansion is a separate action.
- every selected node is initially treated as expandable because progressive payloads do not declare leaf status;
- `applyFocusedExpansionLayout` starts at `-π/2` and distributes children across `2π`, creating cardinal crosses for four children and star-like rings for larger sets;
- the force renderer remains active after initial placement, so node dragging can disturb other coordinates;
- the inspector lists related knowledge before the Knowledge Card; and
- the graph renderers do not expose a background interaction for dismissing the inspector.

The Chaoxing reference demonstrates useful behavior rather than a visual target: direct node activation, outward fan-shaped revelation, restrained focus dimming, staged relation reveal, and stable surrounding context. ACT should adopt those principles within the existing “智控深蓝” workspace, tokens, relation grammar, progressive loading, and floating-inspector contracts.

## Goals / Non-Goals

**Goals:**

- Make a node itself the primary interaction target, with one click producing the correct expand/collapse or inspect outcome.
- Give the client authoritative expandability information before it chooses the click branch.
- Place newly revealed children in an outward sector that communicates hierarchy and preserves already visible positions.
- Freeze the graph after initial layout so dragging changes only the dragged node.
- Add purposeful, short graph transitions with a complete reduced-motion path.
- Dismiss the inspector on blank-space activation or drag start, and place related knowledge below the Knowledge Card.
- Preserve 2D/3D, keyboard, progressive-loading, theme, mobile, and visual-governance compatibility.

**Non-Goals:**

- Replacing the existing graph renderer or relation visual grammar.
- Copying Chaoxing colors, chrome, typography, background treatment, or analytics panels.
- Changing knowledge-node semantics, relation taxonomy, course content, learning paths, ResourceNode binding, or Konling permissions.
- Introducing free-running physics after initial layout or allowing expansion to optimize the entire graph.
- Adding new node context menus, multi-select authoring, or graph editing tools.

## Decisions

### 1. Server-provided expandability drives direct activation

Progressive node payloads will expose an expansion descriptor derived from the same versioned graph used to build shards:

```ts
type KnowledgeNodeExpansion = {
  state: 'expandable' | 'leaf' | 'unknown';
  revealableNeighborCount?: number;
};
```

`expandable` means activating the node can reveal at least one expansion relation under the unfiltered canonical graph contract. `leaf` means no expansion shard can reveal a neighbor. `unknown` is reserved for stale or compatibility payloads and must resolve through the existing expansion endpoint rather than pretending to be a leaf.

This metadata belongs in root, expansion, active-filter, and remaining payloads, and is tied to `graphVersion`. It does not expose the full relation set and does not remove client-side filter checks.

Alternatives considered:

- **Probe the expansion endpoint after every click:** rejected because the UI cannot choose between inspector and expansion without a delayed guess.
- **Infer expandability from currently loaded links:** rejected because progressive loading makes absence of a loaded link ambiguous.
- **Use node type alone:** rejected because type does not guarantee a revealable neighborhood.

### 2. One node activation resolver owns click and keyboard behavior

Replace the split `handleNodeClick` plus selected-node toggle flow with a resolver that receives the activated node id:

- `expandable + collapsed`: close any inspector, select/focus the graph node, load or reveal its shard, and expand;
- `expandable + expanded`: close any inspector and collapse that node without discarding cached shard data;
- `leaf`: select the node and open its inspector;
- `unknown`: keep the graph interactive, show node-local loading feedback, resolve the expansion shard, then branch only from the response's canonical expandability descriptor;
- `expandable + filtered-empty`: keep the node logically expanded and cached, show a filtered-out node-local state, reveal matching neighbors automatically when filters permit, and collapse on the next activation;
- `loading`: ignore duplicate activation while preserving an honest busy state;
- `error`: the next activation retries the same node.

The node-following expansion button, its viewport-clamping machinery, and the bottom-left expansion instruction panel will be removed. Loading, success, empty, and error feedback will be expressed through bounded node state, an accessible live region, and a compact error notice only when needed.

Keyboard parity will use the existing directory and a renderer-adjacent roving node-control layer or equivalent semantic surface. `Enter` and `Space` must invoke the same resolver as pointer activation; removal of the DOM expansion button must not remove keyboard access.

### 3. Inspector state is secondary to canvas manipulation

The inspector opens only for a leaf node or a relation-list navigation that resolves to a leaf. Every graph, directory, search, deep-link, and Related Knowledge Points entry invokes the same activation resolver. Activating an expandable related item closes the inspector, focuses the corresponding canvas node, and expands it; activating a leaf related item replaces the inspector content; unknown items resolve before either branch. The inspector closes when:

- blank canvas space is activated;
- canvas pan/drag begins;
- node drag begins; or
- an expandable node is activated.

Closing the inspector does not collapse expanded neighborhoods, clear cached shards, or trigger relayout. It only clears inspector visibility and stale reading state.

The desktop and mobile content sequence will be:

1. identity, semantic badges, difficulty, importance, and chapter;
2. description, examples, and keywords;
3. Knowledge Card and its linked/unlinked state;
4. Related Knowledge Points and relation groups;
5. learning-path, evidence, and task actions.

This order puts the node's primary learning object before graph-adjacency navigation.

### 4. Newly revealed neighbors occupy a deterministic outward sector

Focused expansion will no longer place all neighbors across a full `2π` ring. Because the graph is not a strict tree, layout direction uses stable reveal provenance rather than inventing a global parent hierarchy:

1. A chapter root reveals neighbors through outgoing `contains` relations. A normal node reveals the incident neighbors returned by the canonical expansion payload under the existing relation contract.
2. Assign every expansion activation a monotonic client activation sequence before its request starts. Expansion payloads may merge into cache as they arrive, but layout materialization and provenance claims are committed in activation-sequence order after every earlier in-flight activation has succeeded, failed, or been cancelled. When a node is first committed by expansion, record the tuple `(activationSequence, centerId)` as its layout provenance; stable center id breaks any same-sequence batch tie. Preserve the winning provenance until graph-version invalidation or explicit relayout, and never let network response order or later relations rewrite it.
3. If the expanded center has layout provenance, orient the sector along the provenance-node→center vector, continuing away from the provenance node. Otherwise evaluate a fixed clockwise set of candidate directions and choose the lowest occupied-space and label-overlap score, breaking ties by candidate index.
4. Allocate newly materialized neighbors within a bounded sector, initially 140–180 degrees. Order edges by existing semantic density priority (`structure`, `context`, `optional`, `weak`), then relation type, directed endpoint role, neighbor importance descending, stable name, and id.
5. Use additional concentric arcs inside the same sector when one arc cannot maintain readable spacing.
6. Preserve all existing and user-positioned coordinates. If a revealable neighbor is already visible elsewhere, keep its coordinates and only reveal the relation.
7. Give new nodes fixed final coordinates immediately; animation interpolates presentation state, not the canonical layout state.

The algorithm must produce identical coordinates and provenance for identical graph version, activation-intent order, expanded set, layout state, and viewport class, including overlapping requests that return in different network orders. Collision scoring may choose among a small fixed set of sectors but must never start a global force pass.

Alternatives considered:

- **Keep complete rings and rotate them:** rejected because four- and eight-child cases still create cross/star geometry and hide direction.
- **Run a local force simulation:** rejected because it can move loaded nodes, creates nondeterministic screenshots, and weakens drag predictability.
- **Use a fixed right-facing tree:** rejected because it wastes available space and performs poorly near viewport edges.

### 5. Initial layout freezes before direct manipulation

The graph may run its existing deterministic or bounded initial layout while the root view is being established. After that pass:

- canonical coordinates for visible nodes are frozen;
- renderer drag reheating must be disabled or prevented from updating unrelated nodes;
- dragging writes only the dragged node's final coordinates and pin state;
- expansion computes coordinates only for newly materialized nodes;
- filter, inspector, hover, selection, and motion-state updates do not create new node objects with different positions; and
- explicit reset/relayout remains the only user action allowed to recompute the visible graph.

The same ownership rule applies in 2D and 3D. The 3D renderer may keep new children on the center node's local plane or use a shallow deterministic depth offset, but it may not run a separate free-moving topology.

### 6. Motion explains state change without becoming decoration

Motion uses platform timing tokens where available and remains bounded:

- selected focus and unrelated-content dimming transition over approximately 140–180 ms;
- new relations reveal from center to child over approximately 180–240 ms;
- new nodes fade and scale from 0.88 to 1 with a short stable stagger capped so the entire reveal completes within approximately 360 ms; at most 24 nodes receive individual staggering and larger shards reveal the remainder as one bounded batch;
- a bounded local camera translation of approximately 220–280 ms runs only when new nodes would fall outside the safe viewport; it must not perform a full zoom-to-fit;
- collapse reverses opacity/scale briefly before removing the neighborhood while preserving cached coordinates; and
- inspector open/close uses the established drawer transition and never resizes the canvas.

There will be no new expansion-specific perpetual orbiting, pulsing, particle loop, or physics drift. Existing relation-semantic direction particles are not expansion motion and remain unchanged in standard mode. Under `prefers-reduced-motion: reduce`, spatial interpolation, edge drawing, stagger, and animated semantic particles are disabled; static relation lines, endpoints, and arrowheads preserve direction while final state and focus feedback appear immediately.

Every transition is keyed by graph version, target node, and expansion generation. A newer activation, collapse, filter change, graph-version change, or unmount cancels stale node, edge, and camera callbacks so late responses cannot overwrite the latest state.

### 7. Visual language remains ACT-native

The selected node receives a stronger existing-token halo, revealed neighbors retain their semantic node colors, and unrelated content dims without becoming unreadable. Expanded edges retain relation-specific line, endpoint, and direction encoding. Motion may clarify edge direction once during reveal but must not replace non-color semantics or introduce a new neon palette.

## Risks / Trade-offs

- **[Expandability metadata becomes stale across graph versions]** → Store it in the same versioned payload and invalidate it with existing shard cache state.
- **[A sector still collides in a dense neighborhood]** → Score a bounded deterministic set of candidate sectors, add arcs, and translate the viewport locally; never move existing nodes as a fallback.
- **[Concurrent expansion responses race to claim the same neighbor]** → Assign activation sequence before requests, commit layout/provenance claims in intent order, use center id as a stable batch tie-break, and never derive provenance from response arrival order.
- **[Direct click removes an obvious keyboard button]** → Require a semantic node-control path and test pointer/keyboard equivalence before removing the old control.
- **[Unknown compatibility nodes create delayed outcomes]** → Keep `unknown` rare, show node-local busy feedback, and resolve once through the cached expansion endpoint; only canonical `leaf` evidence opens the inspector, while canonical expandable nodes with zero filter-visible neighbors enter filtered-empty state.
- **[Animations reduce performance on large graphs]** → Animate only the newly revealed neighborhood, cap individual stagger at 24 nodes and total duration, batch the remainder, cancel stale callbacks, avoid new continuous effects, and retain an instant reduced-motion path.
- **[Freezing coordinates can preserve a locally imperfect initial layout]** → Keep explicit reset/relayout controls; predictability is preferred over unsolicited optimization during exploration.
- **[Inspector dismissal can surprise users reading content]** → Dismiss only on explicit blank activation or drag start, never on hover, wheel zoom, background loading, or unrelated async updates.

## Migration Plan

1. Add and test versioned expansion descriptors to graph payload builders and fixtures while retaining compatibility handling for missing metadata.
2. Introduce the direct activation resolver and semantic node activation path behind the existing expansion cache.
3. Replace full-ring focused layout with deterministic sector placement and freeze renderer coordinates after initial layout.
4. Add motion and reduced-motion behavior, then remove the node-local button and bottom-left expansion instruction panel.
5. Reorder and dismiss the inspector according to the new state model.
6. Run unit, integration, browser, accessibility, motion, and visual-governance gates in 2D/3D, light/dark, desktop/narrow, and reduced-motion states.

Rollback is a single change rollback because the payload field is additive and old clients ignore it. The previous button and full-ring behavior should not be retained as a parallel feature flag after acceptance.

## Open Questions

None. The product behavior, fallback semantics, motion limits, and information order are defined by this change.
