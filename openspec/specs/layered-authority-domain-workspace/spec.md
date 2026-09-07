# layered-authority-domain-workspace Specification

## Purpose
TBD - created by archiving change render-layered-authority-domain-workspace. Update Purpose after archive.
## Requirements
### Requirement: Authority workspace uses domain and knowledge levels
The active Authority workspace SHALL render a first level containing one circular domain entry per domain in the ACTIVE composite release's domain catalog plus one separate circular aggregate entry, replacing the previous card grid. The number of domain entries SHALL be derived from the active composite release's domain catalog at read time and SHALL NOT be hard-coded. Activating a domain SHALL render a second-level graph of real Authority objects scoped to that domain by progressively loading only that domain's root shard and default published teaching relations; it SHALL NOT render presentation membership as an engineering or teaching relation.

#### Scenario: User opens the root level
- **WHEN** a product user opens current Authority
- **THEN** the canvas SHALL show one circular entry per catalog domain with its human-facing name and short summary, plus the aggregate entry, without member rays or global relation density
- **AND** Formula and KnowledgeStatement objects SHALL not populate the root level

#### Scenario: Domain catalog changes across activations
- **WHEN** a composite release whose domain catalog has a different domain count becomes active
- **THEN** the root level SHALL render exactly the new catalog's domain entries without a code change
- **AND** it SHALL NOT show entries from any inactive release's catalog

#### Scenario: User enters a domain
- **WHEN** a circular domain entry is activated
- **THEN** the workspace SHALL load only that domain's root shard and default published teaching relations and replace root navigation with the domain's bounded object-and-relation view
- **AND** it SHALL preserve a visible return path to the domain level
- **AND** it SHALL NOT fetch the complete global object or relation sets

### Requirement: Published teaching order is the default domain relation layer
A domain's initial relation view SHALL enable every available published ACT_TEACHING containment, prerequisite, and pedagogical-association family by default. Every ActKG engineering family SHALL remain disabled until requested. Runtime presentation SHALL display only published teaching edges and SHALL NOT infer order from live engineering shards, object names, Canonical ID sort, or layout. Build-time composition of the single domain Teaching Projection from course-content-related DomainConcepts and syllabus unit order is required by `domain-teaching-order-coverage` and is not a runtime inference. Teaching service unavailability SHALL NOT block primary Authority object selection or engineering relation filters and SHALL NOT expose repository review-pack state in the runtime product.

#### Scenario: Domain has published teaching edges
- **WHEN** a version-matched Teaching Projection contains published teaching relations for the active domain
- **THEN** its available containment, prerequisite, and pedagogical-association families SHALL be visible by default with registered direction and layer meaning
- **AND** every engineering family SHALL remain off until the viewer enables it

#### Scenario: Domain has no published teaching edge
- **WHEN** the domain teaching coverage is empty, partial, or unavailable
- **THEN** primary Authority objects SHALL remain visible and selectable and the product SHALL show only valid published teaching edges that are actually present
- **AND** the workspace SHALL not infer order from live engineering relations, object names, course order, layout, or repository review candidates

#### Scenario: Domain teaching overlay is unavailable
- **WHEN** the domain teaching coverage cannot be resolved as a published overlay
- **THEN** primary Authority objects SHALL remain visible and selectable
- **AND** the workspace SHALL not infer order from live engineering relations, object names, course order, layout, or repository review candidates

### Requirement: Engineering relations use explicit presentation filters
The workspace SHALL provide reversible filters for structure, derivation-and-representation, application-and-analysis, association, and every other supported engineering presentation family while preserving every relation's exact published predicate, endpoints and direction in detail. Enabling a missing family SHALL load only the active domain's missing shard; disabling and re-enabling a loaded family SHALL change visibility without discarding the shard or resetting graph session state.

#### Scenario: User enables derivation and representation
- **WHEN** the user enables the derivation-and-representation filter
- **THEN** eligible published `derived_from`, `has_formula` and `has_representation` relations SHALL appear with registered human labels
- **AND** none SHALL be restated as a teaching prerequisite

#### Scenario: User disables derivation and representation
- **WHEN** the user disables an enabled derivation-and-representation filter
- **THEN** only that family's visible edges SHALL disappear and the control SHALL remain available for re-enabling
- **AND** coordinates, viewport, teaching edges, other filters, selection, loaded shards, and inspector state SHALL remain unchanged

#### Scenario: User enables association
- **WHEN** the user enables association with no selected node
- **THEN** association edges SHALL remain bounded by the domain presentation budget
- **AND** selection SHALL reveal only a bounded published one-hop neighborhood

### Requirement: Secondary object types are disclosed on demand
Every presentable, authorized, supported node type already materialized in the active domain SHALL be enabled by default. The compact node-type legend SHALL allow Formula, KnowledgeStatement, DomainConcept, SystemModel, ModelRepresentation, and future registered types to be disabled and re-enabled independently. Search, directory selection, or bounded one-hop expansion SHALL materialize eligible objects that were not in the initial bounded shard.

#### Scenario: User opens a domain containing heterogeneous objects
- **WHEN** the bounded domain shard contains presentable objects of several registered types
- **THEN** every materialized type SHALL be visible by default
- **AND** no Formula or KnowledgeStatement SHALL be hidden merely because of its type

#### Scenario: User toggles a node type
- **WHEN** the user disables and later re-enables one registered node type
- **THEN** the workspace SHALL hide and restore that type and its incident visible edges
- **AND** force coordinates, viewport, relation filters, selected node, loaded shards, and inspector state SHALL remain stable

#### Scenario: User searches for a formula
- **WHEN** a presentable Formula is not in the current visible object set
- **THEN** search, directory selection, or bounded one-hop expansion SHALL be able to materialize and select it
- **AND** the formula identifier or raw type SHALL not be used as fallback text

#### Scenario: User searches for an unmaterialized formula
- **WHEN** search resolves a presentable Formula outside the current visible objects
- **THEN** the workspace SHALL load its matching bounded domain context and select it when the Formula type is enabled
- **AND** the formula identifier or raw type SHALL not be used as fallback text

### Requirement: Cross-domain relations use explicit boundary navigation
A published relation whose adjacent object belongs outside the active domain SHALL be represented by a persistent accessible boundary cue on the real source node until the user explicitly follows it. The cue SHALL use an animated halo independent of edge-family visibility; the node drawer SHALL list the human-readable target domain, real adjacent node, and relation meaning. Following the entrance SHALL enter a reviewed target domain before selecting the real adjacent object. 对实际存在的跨领域关系，2D 画布 SHALL 直接渲染其拓扑：目标领域以带名称的虚线圆呈现，跨领域概念作为该圆内的节点按领域聚类，并与域内端点绘制真实关系边；顶部横幅式「跨领域入口」列表 SHALL 被移除，不再占用画布上方主画面。点击画布内跨领域节点 SHALL 等价于跟随该边界进入对应领域。

#### Scenario: Cross-domain edge visibility is disabled
- **WHEN** the user disables the relation family that contains a current accessible cross-domain relation
- **THEN** the edge geometry MAY become hidden while the source node's verified boundary halo and drawer entrance remain available
- **AND** the cue SHALL NOT disclose a target outside the current user's authorization

#### Scenario: User follows a cross-domain neighbor
- **WHEN** the user activates an eligible boundary entrance from the node drawer or clicks a cross-domain cluster node on the 2D canvas
- **THEN** the workspace SHALL show the target domain name and relation meaning, load the target domain, and focus the real adjacent object
- **AND** it SHALL not load the target domain's full content, create a proxy node, or treat the root domain circle as the adjacent object

#### Scenario: Cross-domain relations render on the canvas
- **WHEN** the active domain has accessible relations whose adjacent objects belong to one or more reviewed target domains
- **THEN** the 2D canvas SHALL render each involved target domain as one labeled dashed circle containing its cross-domain concept nodes, with real edges connecting in-domain endpoints to those nodes
- **AND** no banner list above the canvas SHALL duplicate these entries

### Requirement: Root domain entries are line-free circular navigation projections
The root view's circular domain entries SHALL be presentation-only navigation projections arranged by deterministic spatial packing. The root view SHALL NOT draw connecting lines, edges, rays or decorative links of any kind between root entries or between an entry and the aggregate entry, and root entries SHALL NOT be presented as ActKG knowledge objects. If published inter-domain Authority or teaching relations become available in an active release, rendering them at the root SHALL require a separately approved proposal and SHALL NOT occur by default.

#### Scenario: Root entries render
- **WHEN** the root view renders its circular domain entries and the aggregate entry
- **THEN** no line, edge, ray or connector geometry SHALL be drawn between any two entries
- **AND** the spatial arrangement SHALL NOT be presented as a navigation hierarchy or semantic relation

#### Scenario: Active release contains published inter-domain relations
- **WHEN** the active composite release contains published relations whose endpoints belong to different domains
- **THEN** the root view SHALL still render no lines between entries
- **AND** those relations SHALL remain reachable only through domain-level views and explicit cross-domain boundary navigation

#### Scenario: A circular entry lacks a human-facing label
- **WHEN** a catalog domain has no non-empty human-facing display name or summary
- **THEN** the entry SHALL fail closed with a controlled unavailable state
- **AND** it SHALL NOT substitute an internal identifier, release identity, enum or path

### Requirement: Root domain entries fit complete multiline labels
Each active root domain entry SHALL measure its complete human-facing name and summary, wrap them within the available circular width, and use a bounded content-aware radius in deterministic packing. Root entries MUST NOT truncate by fixed character count, allow text to cross another entry, or draw a relation line.

#### Scenario: Root entry has a long Chinese name
- **WHEN** the complete domain name requires multiple lines at the active viewport
- **THEN** the entry SHALL wrap the name within the reviewed line and font bounds and enlarge its collision radius when needed
- **AND** the complete readable name SHALL remain inside the circular entry without overlapping another entry

#### Scenario: Root view resizes
- **WHEN** the viewport changes between supported desktop and mobile sizes
- **THEN** root entries SHALL be repacked deterministically from their final measured radii
- **AND** no connector, membership ray, or decorative line SHALL be introduced

### Requirement: Published teaching relations form visible default edge geometry
When a version-matched domain-default shard declares one or more published teaching relations, the initial domain view SHALL materialize both endpoints and render non-empty visible edge geometry with readable direction. A declared teaching relation MUST NOT disappear because one endpoint was excluded by the initial object budget or because the renderer initialized as an isolated-node grid.

#### Scenario: Domain shard contains teaching relations
- **WHEN** the user enters a domain whose matched default shard contains published direct teaching relations
- **THEN** every admitted default teaching relation SHALL have resolvable visible endpoints and edge geometry within the bounded initial graph
- **AND** teaching direction and layer meaning SHALL be distinguishable without exposing internal enums

#### Scenario: Domain shard contains no teaching relation
- **WHEN** the matched default shard reports empty or unavailable teaching coverage
- **THEN** primary objects SHALL remain selectable and the view SHALL explain the missing teaching layer
- **AND** the workspace SHALL not fabricate edges from engineering relations, names, course order, or layout proximity

### Requirement: Engineering relation filters remain independently available
The domain workspace SHALL retain independent reversible filters for every supported engineering presentation family while all available published teaching families form the default layer. Enabling or disabling an engineering family SHALL request only its missing domain shard and SHALL preserve current domain, teaching edges, selected node, inspector, coordinates, pan, zoom, node filters, and every other relation filter.

#### Scenario: User enables another relation family
- **WHEN** the user enables structure, derivation-and-representation, application-and-analysis, association, or another registered engineering family
- **THEN** eligible published engineering edges for that family SHALL be added with exact predicate, direction, endpoints, and registered human labels
- **AND** they SHALL not replace or be restated as teaching relations

#### Scenario: User changes several relation filters
- **WHEN** multiple teaching or engineering families are enabled or disabled repeatedly
- **THEN** only eligible edge visibility and missing domain-shard requests SHALL change
- **AND** the graph SHALL retain established node positions, viewport, node filters, selected node, and active inspection state

### Requirement: Knowledge workspace controls have one non-overlapping owner
The active-domain return action, the ordinary `新版`/`旧版` switch, and the active 2D/3D switch SHALL share one responsive top-right toolbar owned by the knowledge workspace. The title surface SHALL not compete for the same absolute position, and all controls SHALL remain visible, keyboard reachable, and non-overlapping on supported desktop and mobile viewports.

#### Scenario: User enters an active domain on desktop
- **WHEN** the domain title, return action, version switch, and dimension switch are visible
- **THEN** one top-right toolbar SHALL contain the interactive controls without overlapping the title or canvas content
- **AND** every control SHALL expose its current state and accessible name

#### Scenario: User opens the workspace on mobile
- **WHEN** the toolbar must fit a supported narrow viewport
- **THEN** its compact responsive treatment SHALL keep return, version, and dimension actions reachable without covering the primary canvas
- **AND** the graph title SHALL not create a second overlapping control surface

### Requirement: Navigation levels are backed by distinct bounded server responses
Root, domain overview and selected semantic neighborhood SHALL each use a distinct version-matched bounded response. Client filtering of a previously fetched complete domain MUST NOT satisfy a navigation level.

#### Scenario: Product QA inspects domain traffic
- **WHEN** QA enters a domain and then selects one concept
- **THEN** the request sequence SHALL contain a bounded domain overview followed by a bounded one-hop request
- **AND** no ordinary request SHALL return the complete domain object set

#### Scenario: Search locates an undisclosed object
- **WHEN** search resolves an eligible object outside the current overview
- **THEN** selection SHALL load only its owning-domain context and bounded one-hop network
- **AND** search SHALL not promote every matching type into the domain overview

### Requirement: Active semantic filters live in one dedicated panel
The active workspace SHALL provide relation-family content filters as compact bottom-left canvas chips matching the old graph control: reversible multi-select labels with registered line samples, including the default teaching-order chip. The chips SHALL sit at the canvas corner (`bottom-0 left-0`, with the established Konling clearance when that launcher is expanded). The global workspace toolbar SHALL contain only graph-version, language, dimension, fit, reflow and domain-return actions and SHALL NOT host relation filters.

#### Scenario: Viewer opens filters on desktop
- **WHEN** an active domain canvas is visible on desktop
- **THEN** teaching-order and engineering-family chips SHALL appear at the bottom-left canvas corner
- **AND** search or layout controls SHALL not duplicate those chips in the top toolbar

#### Scenario: Viewer opens filters on mobile
- **WHEN** the same canvas is opened on a compact viewport
- **THEN** the same chip state SHALL remain available at the bottom-left corner or the established mobile equivalent
- **AND** closing any compact overlay SHALL restore focus without changing the graph

### Requirement: Ordinary active graph has no visible all-node directory
The active canvas SHALL NOT render a visible grid or list containing all materialized nodes as a fallback for missing Teaching relations, zero visible edges or formula availability. Semantic node controls SHALL remain screen-reader accessible and bounded discovery SHALL remain available through search.

#### Scenario: Teaching projection is unavailable
- **WHEN** a domain concept overview has no Teaching edges
- **THEN** the canvas and explicit empty-state/filter controls SHALL remain the visible product surface
- **AND** no bottom all-node directory SHALL appear

