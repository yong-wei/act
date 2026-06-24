# Knowledge Graph Workspace Design Handoff

Date: 2026-06-14
Surface: `/knowledge`
Evidence:
- `artifacts/product-design-audits/knowledge-graph-2026-06-14/01-current-chrome.png`
- `artifacts/product-design-audits/knowledge-graph-2026-06-14/02-node-drawer-chrome.png`
- Safari current-window inspection supplied by the user, showing `/knowledge` with a selected node drawer.

## Scope

Redesign the knowledge graph page within the unified platform shell. The work should cover layout, local graph tools, relation visual grammar, selected-node drawer, and graph interaction stability. It should not create a separate platform navigation system for knowledge resources.

The page should align with the commercial platform shell direction already used for Arena and the virtual simulation shell proposals:

- Global AppShell remains responsible for primary navigation, theme switching, role state, and user center.
- Knowledge-specific controls remain local workspace tools.
- Multi-level knowledge context should use a compact local command surface, not a competing sidebar system.
- Light and dark modes must both read as first-class product surfaces.

## Global Shell Dependency

The knowledge graph redesign depends on a platform-wide AppShell behavior contract:

- The desktop left platform navigation should default to collapsed state.
- Once a user expands or collapses it, the chosen state should persist across platform pages.
- The state should remain stable until the user changes it again.
- This is a global shell preference, not a route-local state.
- Implementation should avoid hydration mismatch: the server can render a safe default, but the client should resolve the stored preference predictably and without visible layout thrash.

Current implementation note: `src/components/platform/app-shell.tsx` keeps `navigationCollapsed` as `useState(false)` inside `AppShellDesktopLayout`, so the shell currently defaults to expanded and resets on route transitions or remounts. This should be handled before or alongside the knowledge graph layout polish because persistent collapsed navigation affects available graph canvas width and visual continuity.

Boundary check against existing OpenSpec state:

- Existing `commercial-workspace-surface-system` covers the existence and geometry of expanded/collapsed desktop navigation.
- Existing `commercial-ui-governance-gates` covers visual evidence for desktop expanded, desktop collapsed, and mobile drawer states.
- Archived `fix-app-shell-collapsed-navigation-contract` fixed collapsed rail width, icon labels, focus order, and content expansion.
- Archived `unify-arena-workspace-shell` mentioned "persisted or route-stable state where appropriate", but did not create a platform-wide persistence contract.
- Active simulation governance changes only require state evidence; they do not own AppShell default or preference persistence.

Therefore, "default collapsed + cross-page user preference persistence" should be proposed as a separate AppShell/platform-design-system change unless a newer remote change introduces it before proposal time. Knowledge graph changes should reference that shell contract as a dependency and should not own platform-wide preference storage.

## Current Findings

### Layout

The current page has already moved away from the old permanent three-panel layout, but the workspace is still visually crowded.

- The left chapter directory is collapsed by default, but its vertical rail still consumes a large strip of the graph canvas.
- The relation filter card is compact when closed, but it visually competes with graph content and uses a conventional card treatment rather than an integrated tool cluster.
- The view-mode control floats separately on the top right, unrelated to directory, filters, legend, or layout controls.
- The graph uses the available canvas, but dense edges and bright relation colors make the graph feel like one tangled mass.

### Graph Visual Expression

The visual configuration already has relation semantic hooks and node scaling hooks, but the rendered result does not yet communicate structure clearly.

- Orange relation lines dominate the graph and reduce the perceived distinction between edge types.
- Edge width and opacity are still too strong for a 591-node graph.
- Nodes have multiple colors and glow treatments, but importance and neighborhood hierarchy are not visually obvious enough.
- Labels are readable for a small number of hub nodes, but focus and relation meaning are not sufficiently guided.
- Relation legend samples exist in code, but the default collapsed state does not make edge semantics discoverable in a lightweight way.

### Selected-Node Drawer

The right drawer opens and provides useful content, but it currently feels like a scrollable content page placed over the graph.

- Width is fixed at `min(22rem, calc(100vw - 1rem))`, which is too narrow for infographs and too rigid for desktop work.
- It sits at `right-2 top-2` inside the graph workspace and competes with the graph rather than forming a stable inspector zone.
- It uses many stacked cards with similar visual weight, causing poor information hierarchy.
- The information graph image is valuable, but it dominates the narrow drawer and forces scrolling early.
- Content is remounted through `key={selectedNode.id}`, which can create visible reset/flicker when moving between nodes.

### Interaction Stability

The user-reported jitter is consistent with the implementation.

- `KnowledgeGraph2D` clones nodes and calls `applyRadialLayout(...)` whenever `nodes` or `links` change.
- `KnowledgeGraphCanvas` clones nodes and writes layout coordinates inside `graphData`.
- `KnowledgeGraphSystem` uses selected and hovered nodes to rebuild focus neighborhoods, filtered nodes, filtered links, and injected chapter nodes.
- Clicking a node changes selection, opens the panel, may change the visible node set, and causes ForceGraph to receive new graph object identities.
- Dragged node coordinates are not persisted in a stable layout store; follow-up state changes can reapply layout and remove the user's manual arrangement.

The desired behavior should be treated as a product contract, not a visual preference:

- Selecting a node must not recompute the global layout.
- Opening or closing the drawer must not reheat, refit, or redistribute the graph.
- Dragging a node must preserve that node position and avoid adaptive redistribution of unrelated nodes.
- Automatic layout is allowed only on first load, major filter/data changes, or an explicit user action such as "重新布局".
- Hovering a node must not recompute filters, rebuild graph objects, or trigger a full graph redraw.
- Hover should provide a lightweight name preview and optional local emphasis only.

## Target Experience

### Desktop Layout

Use a canvas-first workspace with three stable layers.

1. Global shell:
   - Same collapsed/expanded AppShell pattern as other primary pages.
   - Default left navigation should be collapsed in normal student browsing.
   - Theme switch and user center stay in the platform shell.

2. Local graph tools:
   - A compact top-left or left-edge tool cluster for directory, filters, legend, and layout.
   - Default state should show only concise controls and active summaries.
   - Directory and filters open as popovers or anchored panels, not permanent panels.
   - Relation legend should be visual-first: line samples, endpoint markers, dash styles, and short Chinese labels.
   - View mode, fit, relayout, and pin controls should be part of the same graph tool system.

3. Node inspector:
   - A stable right inspector rail on desktop, not a temporary content card.
   - Suggested width: 400-460px, with a max near 34vw and a min near 360px.
   - It should use a calm hierarchy: header, semantic metadata, short summary, infograph preview, relations, actions.
   - The inspector should not squeeze or re-layout the graph abruptly. If the graph viewport changes, it should use a predictable reserved area or overlay rule.

### Mobile Layout

- Global navigation remains the platform mobile shell.
- Directory, filters, legend, and graph controls should become a bottom sheet or compact command bar.
- The selected-node inspector should become a bottom sheet with clear snap heights.
- Graph pan/zoom should remain reachable while local sheets are collapsed.

## Graph Visual Direction

The graph should move from "bright network mass" to "semantic map".

- Default relation lines should be thin, low-opacity, and clearly subordinate to nodes.
- Important or selected neighborhood edges may intensify, but only in the active neighborhood.
- Edge types need differentiated forms:
  - prerequisite: directed fine solid line
  - contains: subtle structural line, lower saturation
  - method/application: curved or dashed directed line
  - evidence/example: dotted or low-weight line
  - contrast/constraint: distinct endpoint marker or restrained accent
- Node size should reflect importance and graph degree, but the range must stay bounded so hubs do not overwhelm the canvas.
- Selected node treatment should use a refined focus ring and local halo, not a heavy global color jump.
- Non-neighborhood content should dim without disappearing unless the user chooses focused mode.

## Interaction Contracts

### Selection

Node click should only:

- update `selectedNodeId`
- open or update the inspector
- update highlight/focus styling
- optionally update URL state

Node click must not:

- recreate graph node objects
- rerun radial layout
- call zoom-to-fit or center-at implicitly
- reset dragged coordinates
- change relation density mode without user action

### Dragging

Node drag should:

- pin the dragged node by id
- store the final x/y/z coordinates in a layout state map
- keep unrelated nodes stable
- expose a clear "取消固定" or "重置布局" action if pinning is persistent

Node drag should not:

- trigger global fit-to-view
- trigger relation filter recomputation beyond normal render styling
- move other clusters merely because one node was dragged

### Hover

Node hover should:

- show a lightweight name preview near the pointer or selected node
- optionally show node type, chapter, and relation count in a compact tooltip
- update only a transient hover overlay or low-cost style state
- debounce or throttle hover updates where the graph library emits dense pointer events

Node hover should not:

- change `focusNodeId` used for filtering or graph data derivation
- rebuild `focusNeighborhood`, `filteredNodes`, `filteredLinks`, or `graphWithChapterNodes`
- remount node objects or ForceGraph data
- trigger automatic camera movement, layout warmup, or fit-to-view

Existing code has a richer top-center hover preview, but it is coupled to `hoveredNode` and the same state also feeds graph filtering. The redesign should split these concerns: `hoverPreviewNodeId` may drive the tooltip, while persistent focus/filter should come from explicit selection or an explicit focused-mode command.

### Layout

Initial layout and runtime interaction should be separated.

- Initial layout may use chapter/radial layout.
- Runtime graph nodes should be stable mutable objects keyed by node id.
- Data/filter changes should patch existing graph objects instead of replacing every node object.
- Layout recalculation should be gated by a layout version or explicit relayout command.
- Filter changes may hide/show nodes, but selection and drawer changes should be style-only.

## Implementation Implications

Likely implementation areas:

- `src/features/knowledge/knowledge-graph-system.tsx`
- `src/features/knowledge/graph/knowledge-graph-2d.tsx`
- `src/features/knowledge/graph/knowledge-graph-canvas.tsx`
- `src/features/knowledge/graph/layout-engine.ts`
- `src/features/knowledge/resource-panel/resource-panel.tsx`
- `src/features/knowledge/graph/visual-config.ts`

Recommended architecture:

- Add a platform shell preference hook for collapsed navigation state, with default collapsed and cross-route persistence.
- Introduce a layout-state hook for graph nodes, pinned nodes, and layout version.
- Replace per-render cloned graph data with stable graph object reconciliation by id.
- Keep selection and hover as render styling inputs only.
- Split transient hover preview from graph filter focus; hover should not become the graph filtering focus by default.
- Remove `key={selectedNode.id}` from the whole resource panel; key smaller internal async content only if needed.
- Fetch node details through an identity-aware async envelope that prevents stale requests from overwriting current content.
- Add explicit graph controls: "适应视图", "重新布局", "固定布局", "清除固定".
- Move directory/filter/legend/view controls into one `KnowledgeGraphToolbar` or equivalent local-tool component.

## Acceptance Criteria

Visual:

- AppShell desktop left navigation defaults to collapsed and persists the user's expanded/collapsed choice across route changes.
- `/knowledge` uses the unified platform shell and default collapsed global navigation.
- Directory, relation filters, legend, and graph controls are compact by default and do not occupy large permanent regions.
- Relation legend is visual-first with line samples and Chinese labels.
- Light and dark modes both use platform tokens and avoid page-local color palettes.
- Selected-node drawer has a stable desktop inspector width and a clear information hierarchy.
- Mobile uses drawer/sheet patterns for local tools and node inspector.

Interaction:

- Clicking a node opens or updates the inspector without visible graph jitter.
- Hovering a node shows a lightweight name preview without visible graph jitter.
- Opening or closing the inspector does not trigger global relayout.
- Dragging a node preserves the dragged position after selection changes, drawer updates, and hover changes.
- Other nodes do not redistribute after a user drag unless the user explicitly asks to relayout.
- Filter changes are allowed to change visible nodes and edges, but they must not erase manually pinned node positions.

Technical:

- Tests verify AppShell collapsed navigation defaults and persisted user preference across multiple route frames.
- Tests verify that selection changes do not rebuild layout state.
- Tests verify that hover changes do not rebuild layout state or filtered graph data.
- Tests verify dragged node coordinates survive selection and panel state changes.
- Browser evidence captures default, selected-node, dragged-node, light, dark, desktop, and mobile states.
- Commercial UI governance checks current source and runtime behavior rather than relying only on screenshots.

## OpenSpec Proposal Shape

This should likely be a small series, not one broad change:

1. `stabilize-knowledge-graph-layout-interactions`
   - Owns click jitter, hover jitter, node identity, drag persistence, and explicit relayout controls.

2. `redesign-knowledge-graph-local-tools`
   - Owns compact directory/filter/legend/view controls and mobile sheets.

3. `redesign-knowledge-node-inspector`
   - Owns right inspector size, visual hierarchy, async loading, and responsive drawer behavior.

4. `refine-knowledge-graph-visual-semantics`
   - Owns thin relation lines, visual legend, node hierarchy, focus neighborhood styling, and theme parity.

5. `govern-knowledge-workspace-visual-and-interaction-qa`
   - Owns browser evidence and hard gates for shell alignment, interaction stability, light/dark, and responsive states.

6. `persist-app-shell-navigation-preference`
   - Owns platform-wide default collapsed navigation and cross-page persistence. Current local and fetched `origin/integration` OpenSpec state does not cover this as a SHALL-level contract, so this should be a separate prerequisite or sibling platform-shell change.

The shell persistence item and the graph interaction stability item should precede visual polish because unstable layout state and shifting canvas width can undermine any visual redesign.
