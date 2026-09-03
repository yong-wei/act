# active-authority-legacy-force-runtime Specification

## Purpose
TBD - created by archiving change migrate-active-authority-to-legacy-graph-engine. Update Purpose after archive.
## Requirements
### Requirement: Active Authority uses the established Force Graph runtime
The active Authority product canvas SHALL render through the established old-graph Force Graph runtime rather than a separate fixed-viewBox or static-coordinate renderer. The active view SHALL occupy the workspace available below the shared shell, default to 2D, retain 3D, and support wheel and touch zoom, pan, node drag and pin, force reflow, dynamic relation effects, hover preview, selection, and camera fitting in both supported dimensions.

#### Scenario: User opens an active domain in 2D
- **WHEN** a user enters an active domain with presentable nodes
- **THEN** the Force Graph canvas SHALL fill the available workspace and accept the established wheel, pan, drag, pin, selection, and hover interactions
- **AND** button-only zoom or static coordinates SHALL NOT be the primary interaction contract

#### Scenario: User switches active mode to 3D
- **WHEN** the user changes the active graph from its default 2D view to 3D
- **THEN** the 3D view SHALL consume the same active semantic view model and preserve relation filters, node filters, selection, and drawer meaning
- **AND** it SHALL NOT switch to old graph data or a separate relation truth

#### Scenario: Active presentation needs an unsupported primitive
- **WHEN** an active-only visual requirement is not yet supported by the shared Force Graph runtime
- **THEN** the shared runtime SHALL receive a backward-compatible presentation extension
- **AND** the product SHALL NOT add or restore a second active canvas engine

### Requirement: The Authority adapter preserves bounded active truth
The active adapter SHALL consume only version-matched active root, domain-default, relation-family, neighborhood, and detail shards plus eligible formal projections. It MUST preserve exact object identity, relation endpoints, predicate, direction, layer, and authorization and MUST NOT fetch an old graph API, reinterpret an engineering edge as teaching, or synthesize topology.

#### Scenario: Active domain data is adapted
- **WHEN** the adapter receives a matching bounded active domain shard
- **THEN** it SHALL emit only supported semantic nodes and published relations from that envelope
- **AND** no old graph response, cached DTO, or presentation-only edge SHALL enter the active view model

#### Scenario: Root navigation is adapted
- **WHEN** the adapter receives circular domain entries from the active root shard
- **THEN** it SHALL keep them as line-free navigation projections outside the Canonical node and edge model
- **AND** they SHALL NOT become relation endpoints, selectable knowledge nodes, or node-drawer identities

#### Scenario: Optional projection is unavailable
- **WHEN** a teaching or resource projection is missing, mismatched, or unauthorized
- **THEN** the adapter SHALL omit its relations, markers, and launches while retaining eligible base semantic nodes
- **AND** it SHALL NOT infer replacements from names, old data, engineering relations, or layout

### Requirement: Old and active graph sessions are fully isolated
The shared runtime SHALL namespace loaded data, cache entries, force coordinates, camera or viewport, node and relation filters, selected node, hover state, and drawer state by graph data mode. Switching between `新版` and `旧版` SHALL restore the destination mode's own state without mapping identities by label, type, or similarity.

#### Scenario: User returns to active mode
- **WHEN** a user leaves active mode for old mode and later returns
- **THEN** the active graph SHALL restore its own loaded shards, coordinates, viewport, filters, selection, and drawer state
- **AND** no old node, relation, response, coordinate, or cache entry SHALL be merged into it

#### Scenario: User returns to old mode
- **WHEN** a user changes old-mode state and later returns from active mode
- **THEN** the old graph SHALL restore its own state independently
- **AND** active Canonical identity SHALL NOT be matched to an old node by name or type

#### Scenario: User changes active dimension
- **WHEN** active mode switches between 2D and 3D
- **THEN** active semantic filters, selection, and drawer SHALL remain consistent
- **AND** each dimension MAY restore only its own camera and spatial coordinates

### Requirement: Active node decoration uses one content-aware geometry
An active Force Graph node SHALL place every eligible visual resource family marker, the Knowledge Card star, and any cross-domain halo inside or immediately on its governed glyph boundary without creating separate marker hit targets. One bounded final glyph size SHALL govern 2D collision, 3D hit testing, edge endpoints, external-label placement, and camera fitting.

#### Scenario: Node has several formal resource families
- **WHEN** a node has authorized formal bindings for more than one visual resource family
- **THEN** its glyph SHALL display one internal marker for every present family at the same time and adjust within the approved size bound
- **AND** selecting any part of the node SHALL open the single node drawer rather than a marker-specific renderer

#### Scenario: Node has a Knowledge Card
- **WHEN** a current authorized formal Knowledge Card is bound to the node
- **THEN** the node SHALL show the internal star marker
- **AND** it SHALL NOT add a second generic card-family marker for the same card qualification

#### Scenario: Node has an accessible cross-domain relation
- **WHEN** the current Authority contains a published cross-domain relation visible to the current user from that node
- **THEN** the node SHALL display a persistent animated halo and its drawer SHALL retain the boundary entrance
- **AND** disabling that relation family's edge visibility SHALL NOT remove the halo or the verified entrance

#### Scenario: Optional content is not eligible
- **WHEN** a resource, card, or cross-domain target is not formal, current, identity-matched, or accessible
- **THEN** the corresponding decoration SHALL be omitted
- **AND** the semantic node SHALL remain available when its base presentation is otherwise valid

### Requirement: Unavailable-name review is a development-only static artifact
The ordinary active product graph SHALL exclude objects whose governed human-readable name is unavailable and SHALL also exclude their incident edges. A development generator SHALL produce a sanitized local static review artifact from frozen inputs by reusing the production Authority adapter and shared 2D/3D Force Graph runtime, with normal-only, all, and unavailable-only modes.

#### Scenario: Ordinary product data contains an unavailable name
- **WHEN** an active object has only an unavailable-name state
- **THEN** the ordinary product graph SHALL omit that object and its incident edges
- **AND** it SHALL NOT substitute an object identifier, locator, raw type, English fallback, or source value

#### Scenario: Course owner generates the review artifact
- **WHEN** the development generator reads frozen Authority candidate and review inputs
- **THEN** the local static graph SHALL support normal-only, all, and unavailable-only node modes with the shared adapter and engine
- **AND** it SHALL require no application login, runtime role, entitlement, or online write API

#### Scenario: Application and runtime releases are built
- **WHEN** the Next.js application, deploy output, or Runtime Release is assembled
- **THEN** the static review artifact SHALL be absent from routes, public assets, deploy bundles, and release manifests
- **AND** the artifact SHALL contain no credential, signed URL, private original payload, or personal data

### Requirement: Shared Force Graph anchors governed semantic labels
The established Force Graph runtime SHALL provide one source-neutral semantic label layer for qualified active rich titles in both 2D and 3D. The label layer SHALL consume the active adapter's presentation model, remain anchored to Force Graph coordinates, and preserve the existing topology, layout, selection, hit testing, camera, and mode-state ownership. It MUST NOT create a second graph engine, duplicate node identity, or execute rich-text parsing and KaTeX during coordinate-only animation updates.

#### Scenario: Active node title contains mathematics in 2D
- **WHEN** a qualified active rich title becomes visible at the ordinary 2D label level
- **THEN** the semantic label layer SHALL render its complete bounded text-and-math sequence below the governed glyph
- **AND** Force Graph SHALL retain node geometry, dragging, pinning, selection, and edge ownership

#### Scenario: User switches the same active view to 3D
- **WHEN** an active rich title is visible after switching from 2D to 3D
- **THEN** 3D SHALL use the same rich-title model, wrapping bounds, locale, and accessible name
- **AND** the dimension change SHALL NOT reinterpret math, fetch old graph data, or create a second selected node

#### Scenario: Force coordinates update
- **WHEN** force simulation or camera movement changes label screen coordinates
- **THEN** the runtime SHALL update only label placement and ordinary visibility state from cached content
- **AND** it SHALL NOT rerun KaTeX solely because the node moved

### Requirement: Legacy math compatibility remains explicit and bounded
Legacy mode SHALL send only its existing explicit formula fields through the shared mathematics renderer. Legacy names, descriptions, hover text, and other ordinary strings MUST remain text and MUST NOT be scanned for delimiters or TeX commands. A Legacy explicit-formula failure SHALL use the same bounded unavailable behavior and MUST NOT echo raw TeX.

#### Scenario: Legacy detail contains an explicit formula field
- **WHEN** the old graph inspector receives an existing explicit reviewed formula field
- **THEN** it SHALL render through the shared mathematics configuration
- **AND** old and active graph data, caches, selections, and identities SHALL remain isolated

#### Scenario: Legacy title resembles TeX
- **WHEN** an ordinary Legacy title or description contains `$`, a backslash command, or mathematical punctuation
- **THEN** it SHALL remain ordinary escaped text
- **AND** the runtime SHALL NOT infer or persist a mathematics span

### Requirement: Formula labels share the force-owned semantic label layer
The shared 2D and 3D Force Graph runtime SHALL render active Formula expressions through the same semantic DOM label layer used for governed titles. Expression, bounded human context, accessibility and LOD SHALL remain one node-owned presentation.

#### Scenario: Formula is visible in 2D and 3D
- **WHEN** the same Formula node is materialized in either dimension
- **THEN** both dimensions SHALL render the same governed expression and accessible meaning
- **AND** switching dimension SHALL not fetch detail, change formula identity or create a second graph node

### Requirement: Ordinary active nodes remain under live force ownership
Ordinary domain and neighborhood nodes SHALL enter the shared Force Graph runtime as movable seeded nodes. Automatic layout code MUST NOT assign `fx`, `fy` or `fz`; fixed coordinates are reserved for governed root packing and explicit user pins.

#### Scenario: Domain overview settles
- **WHEN** a bounded concept overview enters 2D or 3D
- **THEN** force ticks SHALL move at least one unpinned node and separate collisions before settlement
- **AND** the resulting coordinates SHALL remain within the configured time and viewport budgets

#### Scenario: User pins and unpins a node
- **WHEN** the user drags a node to a fixed location and later removes the pin
- **THEN** only the explicit pin SHALL own fixed coordinates while active
- **AND** unpinning SHALL return the node to force ownership without resetting unrelated nodes

### Requirement: Force reflow is bounded and behaviorally verified
Reflow SHALL reheat the current bounded force scope, preserve user pins, settle under explicit tick/time budgets and update camera fit only after a valid layout milestone. Tests MUST verify movement and settlement and MUST NOT accept zero-tick source-string assertions as parity evidence.

#### Scenario: One-hop nodes arrive
- **WHEN** a selected concept loads a bounded neighborhood
- **THEN** only the affected connected scope SHALL reheat and settle
- **AND** filters, selection, camera and unrelated coordinates SHALL remain stable

#### Scenario: Reflow is requested
- **WHEN** the viewer chooses reflow
- **THEN** the runtime SHALL produce a newly settled movable layout within budget
- **AND** it SHALL not merely regenerate the same fixed automatic anchors

### Requirement: Filter changes preserve force session state
Enabling or disabling any active node type or relation family SHALL preserve coordinates, user pins, force-settlement state, camera, selection, loaded shards and inspector state for every still-visible identity. Filter-only changes MUST NOT restart the entire simulation.

#### Scenario: Viewer toggles one relation family
- **WHEN** one loaded engineering family is hidden and restored
- **THEN** only that family's visible edges SHALL change
- **AND** node coordinates, camera and selected detail SHALL remain stable

#### Scenario: Viewer enables an unloaded family
- **WHEN** the panel requests a missing family shard
- **THEN** the runtime SHALL keep the current graph usable while the bounded shard loads
- **AND** only the affected scope MAY reheat after verified nodes and edges arrive

### Requirement: Force migration completion requires integrated browser evidence
The Force runtime migration SHALL remain incomplete until real 2D and 3D browser probes pass the exact movement, pin, reflow, camera and performance matrix defined by the migration acceptance capability.

#### Scenario: Unit tests pass without browser force evidence
- **WHEN** component and unit tests pass but the integrated force trace is absent or failing
- **THEN** migration completion SHALL be rejected
- **AND** tasks SHALL not be marked complete from implementation inspection alone

