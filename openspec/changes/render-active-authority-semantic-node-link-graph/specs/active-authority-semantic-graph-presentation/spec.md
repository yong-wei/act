## ADDED Requirements

### Requirement: Current Authority is rendered as a semantic node-link graph
The current Authority product workspace SHALL render authoritative objects as compact semantic nodes and published authoritative relations as connecting edges on an interactive graph canvas. It SHALL NOT use an object card grid or a relation card list as the primary graph representation.

#### Scenario: Viewer opens current Authority
- **WHEN** an entitled viewer opens a ready current Authority workspace
- **THEN** the primary content SHALL be a pannable, zoomable and selectable node-link canvas
- **AND** object cards and relation cards SHALL NOT replace the canvas topology

#### Scenario: Viewer selects a graph node
- **WHEN** a viewer selects a visible semantic node
- **THEN** the canvas SHALL emphasize that object and its visible authoritative relations
- **AND** long-form content SHALL appear in a separate detail panel rather than inside the node glyph

### Requirement: Authority objects have typed human-readable node presentation
Every displayed Authority object SHALL use its human-readable semantic name as the visible identity and SHALL map its supported canonical type to a stable Chinese label plus a distinguishable shape, color or icon. An internal object identifier or raw canonical type SHALL NOT be used as visible or accessible fallback content.

#### Scenario: Supported heterogeneous objects are displayed
- **WHEN** DomainConcept, Formula, KnowledgeStatement, SystemModel, ModelRepresentation or another registered Authority type enters the visible subgraph
- **THEN** each object SHALL use its registered Chinese type label and visual treatment
- **AND** the node SHALL display its semantic name without displaying its object identifier

#### Scenario: Object type has no display registration
- **WHEN** a Schema-valid object type has no user-facing presentation registration
- **THEN** the product UI SHALL use a controlled “类型暂不可解释” state or omit the unsupported visual detail
- **AND** it SHALL NOT display the raw canonical type or object identifier

#### Scenario: Object has no human-readable name
- **WHEN** an Authority object lacks a non-empty human-readable semantic name
- **THEN** the product UI SHALL fail closed with a controlled unavailable state for that object
- **AND** it SHALL NOT substitute the object identifier, source locator or another system string

### Requirement: Displayed edges preserve published relation truth
Every displayed edge SHALL correspond to one published current Authority relation with its actual endpoints, predicate and direction. The presentation layer SHALL NOT invent, infer, merge or persist a relation for visual connectivity, and SHALL NOT reinterpret an engineering relation as an unpublished teaching relation.

#### Scenario: Directed engineering relation is displayed
- **WHEN** a visible relation has a registered directed predicate and both authoritative endpoints are visible
- **THEN** the canvas SHALL connect those endpoints with the registered Chinese relation term and an unambiguous arrow direction
- **AND** the underlying predicate, direction and endpoints SHALL remain unchanged

#### Scenario: Unordered association is displayed
- **WHEN** a visible relation is a registered unordered association
- **THEN** the canvas SHALL use its registered Chinese association term and an undirected visual contract
- **AND** it SHALL NOT invent source-to-target teaching order

#### Scenario: Relation vocabulary is unsupported
- **WHEN** a valid future predicate or direction lacks a user-facing registration
- **THEN** the product UI SHALL use a controlled “关系暂不可解释” state or omit that edge from the visible subgraph with an explicit bounded notice
- **AND** it SHALL NOT display the raw predicate, raw direction or relation identifier

#### Scenario: Object has no published relation
- **WHEN** a viewer locates an authoritative object with no published relation
- **THEN** the product UI SHALL identify it as having no published relation
- **AND** it SHALL NOT connect the object by name similarity, layout proximity, course order or generated inference

### Requirement: Large Authority graphs use deterministic progressive exploration
The current Authority canvas SHALL materialize a bounded, deterministic visible subgraph rather than drawing all objects and relations simultaneously. Search, type filtering and successive one-hop exploration SHALL allow a viewer to reach every object that has a human-readable presentation without changing Authority data or selector state.

#### Scenario: Initial Authority overview loads
- **WHEN** the current Authority contains thousands of objects
- **THEN** the canvas SHALL select a deterministic connected entry scope from published relation structure and render only a bounded visible subgraph
- **AND** it SHALL state the visible scope separately from total object and relation coverage without claiming the entry scope is an Authority ranking

#### Scenario: Viewer searches for an object outside the visible subgraph
- **WHEN** a viewer selects a valid search or type-filter result that is not currently materialized
- **THEN** the canvas SHALL materialize that object and its eligible published one-hop neighborhood
- **AND** it SHALL not require all Authority objects to remain rendered

#### Scenario: Viewer explores successive neighbors
- **WHEN** a viewer follows a visible relation to an adjacent object
- **THEN** the visible subgraph SHALL expand or replace its local scope using only published one-hop relations
- **AND** no presentation-only grouping or summary edge SHALL be represented as an Authority fact

### Requirement: Current Authority product UI hides system identity for every role
The student, teacher and administrator current Authority product views SHALL NOT display Release or ReleaseSet identifiers, version hashes, Snapshot/Activation/Projection identifiers, object or relation identifiers, raw enum values, internal source locators or implementation states in visible text, accessible names/descriptions, tooltips, copyable content or fallback messages. Opaque identifiers MAY remain in browser memory, request paths, relationship keys and non-text test hooks solely to establish topology and retrieve authorized details.

#### Scenario: Current Authority header is rendered
- **WHEN** any product role opens current Authority
- **THEN** the header SHALL use human-readable current-authority wording, coverage counts and scope explanation
- **AND** it SHALL NOT display release, snapshot, activation, projection or hash values

#### Scenario: Node and relation content falls back
- **WHEN** a node description, endpoint label, relation label or source display name is missing
- **THEN** the UI SHALL use a controlled unavailable message or omit the field
- **AND** it SHALL NOT substitute an object ID, relation ID, raw enum or locator

#### Scenario: Teacher or administrator opens product detail
- **WHEN** a teacher or administrator opens the same current Authority node detail
- **THEN** any role-additional governance content SHALL use registered human-readable business terms
- **AND** elevated product role SHALL NOT reveal system identity or raw governance enums

#### Scenario: Assistive technology reads the graph
- **WHEN** node, edge, control and detail content is exposed through the accessibility tree
- **THEN** accessible names and descriptions SHALL identify semantic names, relation meanings and interaction state
- **AND** they SHALL contain none of the prohibited system identity strings

### Requirement: Node detail remains semantic, source-safe and focus-managed
Selecting an Authority node SHALL open a detail panel that presents human-readable name, type, explanation, supported instructional content, user-readable source citations and one-hop relation summaries by neighboring semantic name. The panel SHALL NOT expose internal object, relation, neighbor or source identifiers and SHALL preserve the existing responsive focus-entry, close and focus-return contract.

#### Scenario: Viewer reads one-hop relations
- **WHEN** selected node detail contains incoming or outgoing relations
- **THEN** each relation summary SHALL use the registered Chinese relation term, readable direction and neighboring semantic name
- **AND** it SHALL NOT display relation or neighbor identifiers

#### Scenario: Source has only an internal locator
- **WHEN** a source reference has no approved human-readable citation projection
- **THEN** the detail panel SHALL display a controlled source-unavailable message or omit the locator
- **AND** it SHALL NOT expose source edition IDs, section IDs, paths or hashes

#### Scenario: Mobile viewer closes detail
- **WHEN** a mobile viewer opens node detail and then uses Escape or the close control
- **THEN** focus SHALL first enter the detail surface, the panel SHALL close, and focus SHALL return to the originating semantic node or graph canvas
