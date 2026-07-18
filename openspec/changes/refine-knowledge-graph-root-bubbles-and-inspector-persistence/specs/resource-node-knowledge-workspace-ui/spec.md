## ADDED Requirements

### Requirement: Root domains render as stable labeled bubbles
The knowledge graph SHALL render every top-level domain as a dimensional, collision-safe bubble whose complete learner-facing name remains visible inside the node.

#### Scenario: Root map first renders
- **WHEN** the root-domain chooser renders in 2D or 3D
- **THEN** every domain SHALL use a substantial bubble body with platform-token-based depth, highlight, rim, and focus treatment
- **AND** every complete domain name SHALL remain centered inside its bubble without requiring hover, selection, or a zoom threshold.

#### Scenario: Root labels vary in length
- **WHEN** domain names require different measured widths
- **THEN** labels SHALL wrap to no more than three lines at or above the approved readable minimum size
- **AND** bubble collision bounds SHALL include the complete internal label without ellipsis or external label placement.

#### Scenario: Root layout is calculated repeatedly
- **WHEN** the same graph version, root set, and viewport dimensions are laid out more than once
- **THEN** a stable seed SHALL produce identical centered coordinates independent of input order
- **AND** coordinates SHALL form a compact irregular cluster rather than a regular grid, complete ring, or refresh-randomized arrangement.

#### Scenario: Root map renders at desktop or mobile width
- **WHEN** collision-safe root packing is fitted to a supported landscape or portrait viewport
- **THEN** visible bubble bodies SHALL have zero overlaps and preserve the configured minimum gap
- **AND** landscape clusters SHALL use available horizontal space while portrait clusters SHALL remain compact and vertically readable.

### Requirement: Inspector relation and path details use single-open disclosure
The selected-node inspector SHALL present relation overview, canonical corridor, adjacent-domain path details, and learning-path actions as an accessible single-open accordion that starts fully collapsed.

#### Scenario: A knowledge node is selected
- **WHEN** a new selected node exposes one or more relation/path sections
- **THEN** `关联知识点`, `当前规范路径`, `相邻领域路径`, and `学习路径动作` SHALL each render a collapsed summary header
- **AND** no top-level relation/path section or nested relation group SHALL open automatically.

#### Scenario: User expands a relation or path section
- **WHEN** the user activates one of the four section headers
- **THEN** that section SHALL expand and any previously expanded peer section SHALL collapse
- **AND** the header and controlled region SHALL expose synchronized `aria-expanded`, `aria-controls`, keyboard, focus, and chevron state.

#### Scenario: Inspector content updates without changing selection
- **WHEN** graph manipulation or asynchronous detail loading occurs for the current selected node
- **THEN** the active section and inspector scroll context SHALL remain unchanged
- **AND** selecting a different node SHALL reset the four sections and nested relation groups to collapsed.

## MODIFIED Requirements

### Requirement: Knowledge graph interactions preserve layout stability
The knowledge graph SHALL keep layout and inspector state stable when users hover, enter or leave domains, select, inspect, filter, drag, zoom, orbit, or dismiss nodes.

#### Scenario: User hovers over a node
- **WHEN** the pointer hovers over a graph node
- **THEN** the graph MAY show a lightweight name preview and local visual emphasis
- **AND** hover SHALL NOT rebuild graph membership, change relation families, rerun layout, reheat force simulation, or move the camera.

#### Scenario: User moves across many nodes quickly
- **WHEN** pointer movement emits many hover events
- **THEN** preview updates SHALL be throttled, debounced, or renderer-local enough to avoid visible jitter
- **AND** high-frequency hover SHALL NOT change domain, layout version, visible membership, or assistant durable context.

#### Scenario: User activates a domain or knowledge node
- **WHEN** the user clicks, taps, or keyboard-activates a graph node
- **THEN** a domain root SHALL enter its single-domain view and a knowledge node SHALL select, focus, and inspect
- **AND** activation SHALL not recreate unrelated graph objects, rerun global radial layout, reset user-positioned nodes, or call full fit-to-view.

#### Scenario: User opens, updates, or explicitly closes the node inspector
- **WHEN** the inspector opens, updates, closes through its control, or is dismissed by completed blank-space activation
- **THEN** current domain coordinates, viewport scale, family selection, focused corridor, loaded shard state, and applicable disclosure state SHALL remain stable
- **AND** the transition SHALL not redistribute unrelated nodes.

#### Scenario: User manipulates the graph while inspecting a node
- **WHEN** canvas pan, node drag, orbit, wheel, or pinch manipulation begins or completes while the inspector is open
- **THEN** selected node, inspector visibility, focused corridor, disclosure state, and scroll context SHALL remain unchanged
- **AND** manipulation SHALL NOT be reinterpreted as blank-space activation.

### Requirement: Knowledge graph drag state is explicit and recoverable
The knowledge graph SHALL freeze established coordinates after each explicit root or domain layout and preserve user-positioned nodes and inspection state until the user, graph version, or domain navigation requests a new layout or selection.

#### Scenario: Automatic root or domain layout completes
- **WHEN** bounded compact-root or domain layout finishes
- **THEN** visible coordinates SHALL become stable for that navigation state
- **AND** ordinary hover, selection, family toggles, inspector updates, or association-neighborhood changes SHALL not reheat a free-running force simulation.

#### Scenario: User starts dragging a node
- **WHEN** node drag begins while a node is selected or inspected
- **THEN** the selected-node inspector and its active disclosure SHALL remain open and every other visible node SHALL retain its coordinate
- **AND** the active domain and focused corridor SHALL remain selected.

#### Scenario: User releases a dragged node
- **WHEN** the dragged node is released
- **THEN** only that node's final coordinate SHALL be stored as user-positioned
- **AND** no unrelated coordinate or inspector state SHALL be overwritten.

#### Scenario: User drags the canvas
- **WHEN** a canvas pan, orbit, or multi-pointer viewport gesture begins and ends
- **THEN** inspector, selection, focused corridor, and disclosure state SHALL remain stable
- **AND** a moved gesture SHALL NOT trigger blank-canvas dismissal.

#### Scenario: User requests layout reset
- **WHEN** the user explicitly requests relayout, reset, or clear positions
- **THEN** the active navigation state's layout MAY recompute
- **AND** the change SHALL not occur as a side effect of ordinary inspection.

#### Scenario: Retained filters or family visibility change
- **WHEN** node filters or child/post-requisite/association eligibility hide or show content
- **THEN** visible user-positioned and established nodes SHALL retain stored coordinates where possible
- **AND** removed density-mode behavior SHALL not erase positions or become a hidden relayout trigger.

### Requirement: Selected knowledge nodes render in a stable inspector
The knowledge workspace SHALL present selected domain and knowledge-node content through a dismissible stable inspector whose state is independent from domain navigation, progressive graph materialization, and graph manipulation.

#### Scenario: User selects a knowledge node on desktop
- **WHEN** a knowledge node has details, Knowledge Card content, relations, learning actions, or evidence sources
- **THEN** activation SHALL open or update a stable inspector with identity and explanatory content first, Knowledge Card and learning resources next, collapsed normalized relation and canonical corridor disclosures next, raw association details within those disclosures, and evidence actions afterward
- **AND** the inspector SHALL use predictable desktop overlay rules that do not cause graph relayout.

#### Scenario: User enters a domain
- **WHEN** a domain root is activated and its progressive data must load or materialize
- **THEN** navigation, selection, and inspector-open state SHALL be resolved independently
- **AND** loading or entering the domain SHALL NOT close an already valid inspector merely to signal expansion.

#### Scenario: User manually changes away from an inspected node's domain
- **WHEN** a user activates another domain while the inspector and focused corridor target a node outside that destination domain
- **THEN** navigation SHALL clear the hidden node selection and corridor before destination materialization
- **AND** the inspector SHALL close or atomically replace its content with the destination domain summary rather than retaining hidden old-domain content.

#### Scenario: User changes selected node
- **WHEN** selection changes through the canvas, inspector, directory, search, deep link, or cross-domain relation
- **THEN** inspector content SHALL update without remounting the whole workspace or accepting stale async detail responses
- **AND** cross-domain selection SHALL first enter the target node's owning domain and then present the target details.

#### Scenario: Inspector content updates asynchronously
- **WHEN** details, Knowledge Card metadata, child membership, relations, or evidence sources load for the current node
- **THEN** async updates SHALL preserve the user's active inspector section and scroll context where possible
- **AND** they SHALL NOT reset reading position solely because data returned after the inspector opened.

#### Scenario: Child relation is hidden on the canvas
- **WHEN** a selected domain or knowledge node has canonical `contains` provenance while the child family is disabled
- **THEN** the inspector SHALL still expose domain membership or direct child detail, canonical source and target, and contributing relation evidence
- **AND** the user SHALL be able to enable the child family without losing inspector context.

#### Scenario: Raw relation rationale is unavailable
- **WHEN** a canonical link provides id, type, endpoints, and strength but no rationale, evidence, or source document
- **THEN** the inspector SHALL show the available fields and `关系依据未提供`
- **AND** it SHALL not fabricate or imply unavailable evidence.

#### Scenario: Directed association detail is inspected
- **WHEN** the selected node participates in a directed raw association
- **THEN** the inspector SHALL render a reviewed Chinese sentence appropriate to whether the selected node is the authored source or target
- **AND** the sentence SHALL preserve raw type and endpoint direction even though the canvas association edge is unordered.

#### Scenario: User activates blank canvas space
- **WHEN** the user activates canvas space that is not a node, edge control, local tool, or inspector surface without exceeding the movement threshold
- **THEN** the selected-node inspector SHALL close
- **AND** current domain, filters, zoom, pan, cached shards, path focus, and node coordinates SHALL remain unchanged.

#### Scenario: User manipulates the canvas or a node
- **WHEN** the user pans, orbits, zooms, pinches, or drags a node while the inspector is open
- **THEN** the inspector, selected node, active disclosure, and scroll context SHALL remain visible and unchanged
- **AND** manipulation SHALL not leave the current domain, trigger relayout, clear the focused corridor, or evict cached shards.

#### Scenario: Mobile knowledge graph opens a selected node
- **WHEN** a node is opened on a mobile viewport
- **THEN** details SHALL render through a focus-contained drawer or sheet with the same content priority and collapsed relation/path disclosures
- **AND** graph pan, zoom, return navigation, and local tool access SHALL remain reachable when the sheet is collapsed
- **AND** focus SHALL return to the invoking graph context when the sheet closes.
