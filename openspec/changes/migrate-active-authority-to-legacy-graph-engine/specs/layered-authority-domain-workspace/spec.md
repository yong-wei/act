## MODIFIED Requirements

### Requirement: Published teaching order is the default domain relation layer
A domain's initial relation view SHALL enable every available published ACT_TEACHING containment, prerequisite, and pedagogical-association family by default. Every ActKG engineering family SHALL remain disabled until requested. Teaching coverage that is partial, empty or unavailable SHALL NOT block primary Authority object selection or engineering relation filters, SHALL NOT cause engineering relations to be restated as teaching, and SHALL NOT expose repository review-pack state in the runtime product.

#### Scenario: Domain has published teaching edges
- **WHEN** a version-matched Teaching Projection contains published teaching relations for the active domain
- **THEN** its available containment, prerequisite, and pedagogical-association families SHALL be visible by default with registered direction and layer meaning
- **AND** every engineering family SHALL remain off until the viewer enables it

#### Scenario: Domain has no published teaching edge
- **WHEN** the domain teaching coverage is empty, partial, or unavailable
- **THEN** primary Authority objects SHALL remain visible and selectable and the product SHALL show only valid published teaching edges that are actually present
- **AND** the workspace SHALL not infer order from engineering relations, object names, course order, layout, or repository review candidates

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

#### Scenario: User searches for an unmaterialized formula
- **WHEN** search resolves a presentable Formula outside the current visible objects
- **THEN** the workspace SHALL load its matching bounded domain context and select it when the Formula type is enabled
- **AND** the formula identifier or raw type SHALL not be used as fallback text

### Requirement: Cross-domain relations use explicit boundary navigation
A published relation whose adjacent object belongs outside the active domain SHALL be represented by a persistent accessible boundary cue on the real source node until the user explicitly follows it. The cue SHALL use an animated halo independent of edge-family visibility; the node drawer SHALL list the human-readable target domain, real adjacent node, and relation meaning. Following the entrance SHALL enter a reviewed target domain before selecting the real adjacent object.

#### Scenario: Cross-domain edge visibility is disabled
- **WHEN** the user disables the relation family that contains a current accessible cross-domain relation
- **THEN** the edge geometry MAY become hidden while the source node's verified boundary halo and drawer entrance remain available
- **AND** the cue SHALL NOT disclose a target outside the current user's authorization

#### Scenario: User follows a cross-domain neighbor
- **WHEN** the user activates an eligible boundary entrance from the node drawer
- **THEN** the workspace SHALL show the target domain name and relation meaning, load the target domain, and focus the real adjacent object
- **AND** it SHALL not load the target domain's full content, create a proxy node, or treat the root domain circle as the adjacent object

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

## ADDED Requirements

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
