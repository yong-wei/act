## ADDED Requirements

### Requirement: Knowledge graph nodes use direct activation semantics
The knowledge graph SHALL make the node itself the primary expansion or inspection control and SHALL resolve the outcome from versioned expandability metadata.

#### Scenario: User activates a collapsed expandable node
- **WHEN** a user clicks, taps, or keyboard-activates a node declared expandable and currently collapsed
- **THEN** the graph SHALL load or reveal that node's local neighborhood immediately without requiring a second expansion control
- **AND** any open node inspector SHALL close without collapsing other expanded neighborhoods.

#### Scenario: User activates an expanded node
- **WHEN** a user activates a node whose local neighborhood is expanded
- **THEN** the graph SHALL collapse that neighborhood while retaining its version-valid shard cache and stable stored coordinates
- **AND** the action SHALL NOT open the node inspector.

#### Scenario: User activates a leaf node
- **WHEN** a user activates a node declared as a leaf
- **THEN** the graph SHALL open the selected-node inspector
- **AND** it SHALL NOT request an expansion shard or show an expansion control.

#### Scenario: User activates a node with unknown expandability
- **WHEN** a compatibility or stale payload leaves a node's expandability unknown
- **THEN** the graph SHALL show an honest node-local busy state and resolve the existing expansion endpoint once
- **AND** only a canonical leaf descriptor SHALL open the inspector
- **AND** a canonical expandable descriptor with no filter-visible neighbor SHALL enter a cached filtered-empty state instead of being treated as a leaf.

#### Scenario: Active filters hide every neighbor of an expandable node
- **WHEN** a canonically expandable node is activated while the active filters hide all revealable neighbors or relations
- **THEN** the node SHALL remain logically expanded with a local filtered-out explanation and cached expansion data
- **AND** changing filters SHALL reveal newly matching neighbors without a duplicate shard request
- **AND** activating the filtered-empty node again SHALL collapse it.

#### Scenario: User activates a related knowledge item
- **WHEN** a user activates a Related Knowledge Points entry, directory item, search result, or deep link that resolves to a graph node
- **THEN** that entry SHALL invoke the same activation resolver as the 2D and 3D graph node
- **AND** an expandable target SHALL close the inspector, focus the canvas target, and expand or collapse it while a leaf target SHALL open or replace inspector content.

#### Scenario: Progressive graph payload identifies node behavior
- **WHEN** root, expansion, active-filter, or remaining graph payloads return nodes
- **THEN** each node SHALL carry a graph-version-consistent expansion state of expandable, leaf, or unknown
- **AND** the client SHALL NOT infer leaf status solely from currently loaded links or node type.

#### Scenario: User activates a node with keyboard
- **WHEN** keyboard focus reaches a visible graph node through the graph or an equivalent synchronized semantic node surface
- **THEN** Enter or Space SHALL invoke the same activation resolver as pointer activation
- **AND** focus, busy, expanded, leaf, and error states SHALL be exposed without relying on color alone.

### Requirement: Knowledge graph expansion motion explains local topology
The knowledge graph SHALL use short, bounded motion to explain focus and neighborhood revelation while preserving stable canonical coordinates and a complete reduced-motion path.

#### Scenario: Local neighborhood is revealed
- **WHEN** an expandable node successfully reveals new neighbors and relations
- **THEN** the graph SHALL use bounded focus emphasis, center-to-neighbor relation reveal, and staged node appearance to communicate origin and direction
- **AND** the complete reveal SHALL finish promptly without adding expansion-specific continuous orbit, pulse, particle, or force-driven motion
- **AND** existing relation-semantic direction encoding MAY remain active outside reduced-motion mode.

#### Scenario: Expanded content falls outside the safe viewport
- **WHEN** newly revealed nodes would be clipped by the graph viewport or inspector-safe area
- **THEN** the graph MAY perform a bounded local camera translation
- **AND** it SHALL NOT run full-graph zoom-to-fit, reset zoom, or change canonical node coordinates.

#### Scenario: User prefers reduced motion
- **WHEN** `prefers-reduced-motion: reduce` is active
- **THEN** spatial interpolation, relation drawing, and reveal staggering SHALL be disabled or reduced to an immediate state transition
- **AND** animated semantic particles SHALL stop while static relation lines, endpoints, and arrowheads preserve direction
- **AND** focus, expandability, loading, success, and error states SHALL remain perceivable.

### Requirement: Expanded graph neighborhoods use outward sectors
The knowledge graph SHALL arrange newly revealed neighbors in a deterministic outward sector anchored to the expanded node so the result communicates reveal provenance without forming a complete-ring cross or moving existing graph content.

#### Scenario: Node with reveal provenance is expanded
- **WHEN** an expandable node that was first materialized by another expansion reveals new neighbors
- **THEN** the graph SHALL orient the new-neighbor sector along the provenance-node→center vector and continue away from the provenance node
- **AND** later relations to that center SHALL NOT rewrite its layout provenance before graph-version invalidation or explicit relayout.

#### Scenario: Concurrent expansions reveal the same new neighbor
- **WHEN** multiple expansion activations are in flight and their payloads can first materialize the same neighbor
- **THEN** layout materialization and provenance claims SHALL commit in client activation-intent sequence rather than network response order
- **AND** stable center id SHALL break any same-sequence batch tie
- **AND** the winning provenance and resulting coordinate SHALL remain unchanged when later responses merge.

#### Scenario: Node without reveal provenance is expanded
- **WHEN** an expandable root or initially visible node has no layout provenance
- **THEN** the graph SHALL choose from a fixed deterministic set of candidate sectors using occupied-space and label-overlap scoring
- **AND** score ties SHALL resolve by stable candidate index so identical inputs produce identical placement.

#### Scenario: Expansion identifies revealable neighbors
- **WHEN** a chapter root or ordinary node is expanded
- **THEN** a chapter root SHALL reveal outgoing `contains` neighbors and an ordinary node SHALL use canonical incident expansion relations
- **AND** neighbor ordering SHALL use stable semantic-density, relation-type, directed-endpoint, importance, name, and id tie-breaks.

#### Scenario: Expanded node has many new neighbors
- **WHEN** newly materialized neighbors cannot fit on one readable arc within the chosen sector
- **THEN** neighbors SHALL spill into stable additional arcs inside that sector
- **AND** labels, semantic color, hit targets, and relation direction SHALL remain recoverable without using a complete 360-degree ring.

#### Scenario: Revealable neighbor is already visible
- **WHEN** an expanded node is related to a neighbor that already has a visible established or user-positioned coordinate
- **THEN** the neighbor SHALL keep that coordinate and the graph SHALL reveal only the relevant relation
- **AND** the layout SHALL NOT duplicate or relocate the neighbor to complete the local fan.

#### Scenario: User has positioned graph nodes
- **WHEN** a user has dragged or pinned graph nodes before another node is expanded
- **THEN** sector expansion SHALL preserve all user-positioned coordinates and all unrelated established coordinates
- **AND** it SHALL compute automatic coordinates only for newly materialized nodes.

## MODIFIED Requirements

### Requirement: Knowledge graph nodes expand and collapse on demand
The knowledge graph SHALL reveal neighbors and relations through direct node activation instead of showing all filtered nodes by default or requiring a secondary expansion control.

#### Scenario: User activates a collapsed expandable node
- **WHEN** a user clicks, taps, or keyboard-activates a collapsed node declared expandable
- **THEN** the node activation SHALL reveal its filter-visible neighbors and relations
- **AND** the same node SHALL expose accessible expanded or pending state through the synchronized semantic node surface and live status.

#### Scenario: User activates an expanded node
- **WHEN** a user activates an expanded graph node
- **THEN** the same node activation SHALL hide that expansion's revealed neighbors without evicting version-valid graph data from the client cache
- **AND** focus SHALL remain associated with the node activation context.

#### Scenario: Expansion data is not cached
- **WHEN** a user activates an expandable node whose required shard is not yet loaded
- **THEN** the graph SHALL show a local loading state for that node or expansion path and suppress duplicate activation
- **AND** the rest of the graph, local tools, inspector, and floating dock SHALL remain interactive
- **AND** background shard loading SHALL NOT move focus away from the initiating node context, local tool, or Konling surface.

#### Scenario: Expansion has no filter-visible neighbors
- **WHEN** canonical graph metadata identifies the node as expandable but the active filter hides all neighbors or relations in that expansion
- **THEN** the graph SHALL keep the expansion cached and logically expanded while showing a local empty or filtered-out explanation
- **AND** the UI SHALL distinguish filtered-empty from canonical leaf, loading, and network failure
- **AND** a filter change SHALL reveal matching cached neighbors without a duplicate request.

#### Scenario: Expansion request fails
- **WHEN** an uncached expansion request fails
- **THEN** the node SHALL expose an accessible local error and allow the next activation to retry
- **AND** stale or failed responses SHALL NOT open the inspector, move unrelated nodes, or overwrite a newer activation state.

### Requirement: Knowledge graph interactions preserve layout stability
The knowledge graph SHALL keep layout state stable when users hover, activate, expand, collapse, inspect, or dismiss nodes.

#### Scenario: User hovers over a node
- **WHEN** the pointer hovers over a graph node
- **THEN** the graph MAY show a lightweight name preview and local visual emphasis
- **AND** hover SHALL NOT rebuild filtered graph data, change relation density, rerun layout, reheat the force simulation, or trigger automatic camera movement.

#### Scenario: User moves across many nodes quickly
- **WHEN** pointer movement emits many hover events across graph nodes
- **THEN** hover preview updates SHALL be throttled, debounced, or renderer-local enough to avoid visible jitter
- **AND** high-frequency hover SHALL NOT change layout version, filtered graph membership, or assistant durable context.

#### Scenario: User activates a node
- **WHEN** the user clicks, taps, or keyboard-activates a graph node
- **THEN** the graph SHALL resolve direct expansion, collapse, or leaf inspection from that node's current state
- **AND** activation SHALL NOT recreate unrelated graph node objects, rerun global radial or force layout, reset user-positioned nodes, or call fit-to-view.

#### Scenario: User opens or closes the node inspector
- **WHEN** the selected-node inspector opens, closes, updates content, or is dismissed by blank-space activation or drag start
- **THEN** graph layout coordinates, expanded neighborhoods, viewport scale, and loaded shard state SHALL remain stable
- **AND** the inspector transition SHALL NOT redistribute unrelated graph nodes.

### Requirement: Knowledge graph drag state is explicit and recoverable
The knowledge graph SHALL freeze established node coordinates after initial automatic layout and SHALL preserve user-dragged positions until the user or a real graph data change requests a new layout.

#### Scenario: Initial automatic layout completes
- **WHEN** the root graph finishes its bounded initial automatic layout
- **THEN** visible node coordinates SHALL become stable canonical positions
- **AND** subsequent ordinary interaction SHALL NOT reheat a free-running force simulation.

#### Scenario: User starts dragging a node
- **WHEN** the user begins dragging a graph node
- **THEN** any open inspector SHALL close
- **AND** all other visible nodes SHALL retain their current coordinates throughout the drag.

#### Scenario: User releases a dragged node
- **WHEN** the user drags a node and releases it
- **THEN** only that node's final coordinates SHALL be stored by node id as user-positioned or pinned layout state
- **AND** no unrelated node position SHALL be overwritten as a drag side effect.

#### Scenario: User requests layout reset
- **WHEN** the user activates an explicit relayout, reset, or clear-pins command
- **THEN** the graph MAY recompute layout
- **AND** the UI SHALL make the change intentional rather than treating it as a side effect of normal inspection.

#### Scenario: Filters change the visible graph
- **WHEN** relation filters, chapter filters, or density mode changes hide or show graph nodes
- **THEN** visible user-positioned and established nodes SHALL retain their stored coordinates where possible
- **AND** the layout system SHALL not erase pinned positions unless the node is no longer part of the current graph data or the user resets layout.

### Requirement: Selected knowledge nodes render in a stable inspector
The knowledge workspace SHALL present leaf-node content through a dismissible stable inspector whose learning-object content precedes graph-adjacency navigation.

#### Scenario: User selects a leaf knowledge node on desktop
- **WHEN** a leaf knowledge node has details, Knowledge Card content, relations, learning actions, or evidence sources
- **THEN** the UI SHALL render a stable inspector with identity and explanatory content first, Knowledge Card before Related Knowledge Points, and learning-path or evidence actions afterward
- **AND** the inspector SHALL use predictable desktop width or overlay rules that do not cause graph layout jitter.

#### Scenario: User changes selected leaf node
- **WHEN** the selected leaf node changes through the inspector or another semantic navigation surface
- **THEN** inspector content SHALL update without remounting the whole panel or losing stable scroll and layout context unnecessarily
- **AND** stale async detail responses SHALL NOT overwrite the current selected-node content.

#### Scenario: Inspector content updates asynchronously
- **WHEN** details, Knowledge Card metadata, relations, or evidence sources load for the current leaf node
- **THEN** async updates SHALL preserve the user's active inspector section and scroll context where possible
- **AND** they SHALL NOT reset reading position solely because data returned after the panel opened.

#### Scenario: User activates blank canvas space
- **WHEN** the user activates graph canvas space that is not a node, edge control, local tool, or inspector surface
- **THEN** the selected-node inspector SHALL close
- **AND** expanded neighborhoods, filters, zoom, pan, cached shards, and node coordinates SHALL remain unchanged.

#### Scenario: User starts dragging the canvas or a node
- **WHEN** the user begins a canvas pan or node drag while the inspector is open
- **THEN** the inspector SHALL close before the manipulation continues
- **AND** the dismissal SHALL NOT trigger relayout or collapse expanded neighborhoods.

#### Scenario: Mobile knowledge graph opens a leaf node
- **WHEN** a leaf node is opened on a mobile viewport
- **THEN** node details SHALL render through a drawer or sheet with Knowledge Card before Related Knowledge Points
- **AND** graph pan, zoom, and local tool access SHALL remain reachable when the sheet is collapsed
- **AND** keyboard and screen-reader focus SHALL remain inside the opened sheet while active and return to the invoking graph context when closed.

## REMOVED Requirements

### Requirement: Knowledge graph expansion controls follow selected nodes
**Reason**: The node-following expansion button creates an unnecessary second action and cannot distinguish leaf inspection from expansion before the client receives explicit expandability metadata.

**Migration**: Make the semantic graph node activation path invoke the direct activation resolver; preserve loading, error, focus, expanded, and retry feedback on the node and accessible live region rather than a separate expand/collapse button.

### Requirement: Expanded graph neighborhoods are centered on the expanded node
**Reason**: Complete centered rings create cross and star geometry, imply a tree structure the graph does not have, and can relocate already visible neighbors.

**Migration**: Use deterministic outward sectors based on first-reveal layout provenance; place only newly materialized neighbors, preserve existing coordinates, and add arcs within the same sector when needed.
