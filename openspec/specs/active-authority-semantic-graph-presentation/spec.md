# active-authority-semantic-graph-presentation Specification

## Purpose
TBD - created by archiving change render-active-authority-semantic-node-link-graph. Update Purpose after archive.
## Requirements
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

### Requirement: Commercial evidence proves the active semantic canvas without system identity
The product QA capture and governance gate SHALL validate active API/provenance identity using booleans or field counts only, including equality between source release identity and provenance authority identity plus complete snapshot and activation fields, and SHALL NOT persist release, snapshot, hash, activation, projection, node, relation or locator values in active browser evidence. Active visual evidence SHALL prove non-empty semantic nodes, real SVG edge geometry and endpoint resolution against the current DOM nodes. Student, teacher and administrator active views SHALL each pass the same forbidden-surface scan using the current active API response's internal token set plus fixed category vocabulary across text, accessible names/descriptions, title/tooltip and copy interaction payloads, while recording counts rather than matched values.

All API evidence written by the capture SHALL pass through one strict allowlist projector with the exact `safe-api-evidence/v1` shape: fixed `roleClass`; a `sequence` containing only `endpointClass` (`active-canvas`, `active-node`, `legacy`, or `candidate`), numeric `status`, and positive `requestCount`; and exactly the boolean checks `activeNodeRequestObserved`, `activeCanvasIdentityVerified`, `activeNodeIdentityVerified`, `provenanceIdentityVerified`, `roleRequestIsolationVerified`, and `forbiddenDataAbsent`. Real requests and responses MAY remain in capture memory only. The projector and gate SHALL fail closed for unknown Knowledge API endpoints, unknown fields, duplicate endpoint classes, URL/path/query/route/request/response/header/cookie/source-locator/raw-enum/API-identity values, node/relation counts, object fingerprints, dynamic opaque tokens and URI-encoded or decoded token variants. The gate SHALL independently assert active isolation from endpoint classes, status and request counts, not only from the boolean checks. Legacy and candidate SHALL remain fixed classifications with their existing product-state evidence; tasks 4.2 and 4.3 remain unchecked until this contract passes on a clean committed revision with real credentials.

The checks object SHALL also contain required `activeNodeRequestObserved`. Its pair with `activeNodeIdentityVerified` SHALL be exactly false/false when no active-node request was observed, true/false when an observed request failed status, endpoint/selected-node equality or provenance verification, and true/true only for a matching 200 active-node response; false/true SHALL be rejected. The authenticated student/teacher/administrator detail records and the desktop-dark detail state SHALL require an active-node sequence entry with status 200 and positive request count plus true/true. Responsive records without detail interaction SHALL explicitly contain false/false and SHALL NOT inherit node verification from another record.

The capture and gate SHALL share one deterministic `SensitiveValueMatcher` for raw, URI-encoded and once-decoded variants. It SHALL scan API artifact string leaves/JSON bytes and active product DOM text, ARIA, title/tooltip and copy payloads, and SHALL persist only match counts and booleans without matched values or errors.

#### Scenario: Active visual evidence is captured
- **WHEN** the active product QA matrix captures a responsive state
- **THEN** the evidence SHALL contain at least one semantic node and one published edge whose source and target resolve to current DOM nodes with visible SVG geometry
- **AND** the evidence SHALL record one semantic detail or adjacency interaction with focus returned to a semantic node or the graph canvas
- **AND** the interaction evidence SHALL independently record focus on the semantic node before click, focus on the detail panel after open, and focus on the originating semantic node or semantic canvas after close/Escape

#### Scenario: Product evidence is checked for identity leakage
- **WHEN** the governance gate reads active visual or role evidence
- **THEN** it SHALL require passing forbidden-surface scans and no visible copy entry for internal identity values
- **AND** it SHALL reject evidence whose source revision does not match the current adapter, capture and gate source hashes

### Requirement: Active Authority progressive exploration is server-bounded
The current Authority workspace SHALL obtain root, active-domain, requested relation-family, selected one-hop and selected-detail data from bounded server responses. Client-side truncation of a previously fetched full graph SHALL NOT satisfy the progressive-loading requirement.

#### Scenario: First active Authority response is measured
- **WHEN** product QA opens the active Authority workspace with a cold client cache
- **THEN** no ordinary product request SHALL return or parse the complete Authority object and relation sets
- **AND** reviewed root navigation SHALL become usable before any domain member shard is required

#### Scenario: User expands one node
- **WHEN** a selected object requests a one-hop neighborhood
- **THEN** the server SHALL return a deterministic bounded neighborhood using only published relations
- **AND** expansion SHALL not require all graph objects to remain in browser memory

### Requirement: Current Authority presentation separates navigation, teaching and engineering layers
The current Authority canvas SHALL visibly distinguish presentation-only domain navigation, ACT-owned teaching relations and ActKG engineering relations. Product copy and accessibility descriptions SHALL use human-readable layer meaning and SHALL NOT expose internal layer enums, identifiers or version hashes.

#### Scenario: Domain teaching and engineering edges are both visible
- **WHEN** the user enables an engineering relation family while the default teaching skeleton is visible
- **THEN** visual grammar and the legend SHALL distinguish teaching order from engineering semantics without relying on color alone
- **AND** each edge SHALL retain its source layer and exact published relation meaning

### Requirement: Current Authority default view avoids heterogeneous object overload
The active domain's initial canvas SHALL prioritize DomainConcept and SystemModel objects. Formula and KnowledgeStatement objects SHALL remain available through explicit progressive interactions rather than appearing as an undifferentiated first-load set.

#### Scenario: Dense domain is opened
- **WHEN** a domain contains many Formula and KnowledgeStatement objects
- **THEN** the first domain view SHALL remain bounded and readable
- **AND** search and one-hop exploration SHALL still reach every human-presentable object

### Requirement: Current Authority detail includes governed learning media
The current Authority node detail SHALL include eligible Knowledge Card content and accepted infographs when available and authorized. Long-form learning media SHALL remain in the inspector and SHALL NOT replace semantic nodes or published relation topology on the canvas.

#### Scenario: Node detail has governed media
- **WHEN** a selected Authority object has eligible card and infograph projections
- **THEN** the inspector SHALL present them after semantic identity and explanation
- **AND** the canvas SHALL remain the primary graph representation

#### Scenario: Governed media is unavailable
- **WHEN** the selected object has no eligible card or infograph, or the current shard Teaching binding is unavailable
- **THEN** semantic detail and published relation summaries SHALL remain available
- **AND** the UI SHALL omit the unavailable media panels and not expose internal asset or review identity

