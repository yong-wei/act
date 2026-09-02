# active-authority-semantic-graph-presentation Specification

## Purpose
TBD - created by archiving change render-active-authority-semantic-node-link-graph. Update Purpose after archive.
## Requirements
### Requirement: Current Authority is rendered as a semantic node-link graph
The current Authority product workspace SHALL render authoritative objects as compact semantic nodes and published authoritative relations as connecting edges on the established old-graph Force Graph canvas at the domain and knowledge levels. The root level SHALL present circular domain navigation entries without any connecting edges, and every edge rendered anywhere in the workspace SHALL represent a real published Authority or teaching relation. It SHALL NOT use an object card grid, relation card list, fixed-viewBox SVG, or static-coordinate viewport as the primary graph representation at any level.

#### Scenario: Viewer opens current Authority
- **WHEN** an entitled viewer opens a ready current Authority workspace
- **THEN** the root level SHALL present circular domain navigation and entering a domain SHALL present a full-available-workspace force-directed canvas with wheel or touch zoom, pan, drag, selection, hover preview, and reversible filters
- **AND** object cards, relation cards, static coordinates, and button-only zoom SHALL NOT replace the canvas topology or primary interaction

#### Scenario: Viewer selects a graph node
- **WHEN** a viewer selects a visible semantic node
- **THEN** the canvas SHALL emphasize that object and its visible authoritative relations
- **AND** long-form content SHALL appear in a separate detail panel rather than inside the node glyph

#### Scenario: Root level draws no edges
- **WHEN** the root level renders its circular domain navigation entries
- **THEN** no edge geometry SHALL connect the entries
- **AND** no presentation-only line SHALL be represented as an Authority fact

### Requirement: Authority objects have typed human-readable node presentation
Every displayed Authority object SHALL use its governed human-readable semantic name as the visible identity and SHALL map its supported canonical type to a stable Chinese label plus a distinguishable shape, color or icon. An internal object identifier, English fallback, source locator, or raw canonical type SHALL NOT be used as visible or accessible fallback content. The ordinary product graph SHALL exclude an object whose governed display name is unavailable; only the development-only static audit artifact may present its controlled unavailable state.

#### Scenario: Supported heterogeneous objects are displayed
- **WHEN** DomainConcept, Formula, KnowledgeStatement, SystemModel, ModelRepresentation or another registered Authority type enters the visible subgraph
- **THEN** each object SHALL use its registered Chinese type label and visual treatment
- **AND** the node SHALL display its semantic name without displaying its object identifier

#### Scenario: Object type has no display registration
- **WHEN** a Schema-valid object type has no user-facing presentation registration
- **THEN** the product UI SHALL use a controlled “类型暂不可解释” state or omit the unsupported visual detail
- **AND** it SHALL NOT display the raw canonical type or object identifier

#### Scenario: Object has no human-readable name
- **WHEN** an Authority object lacks a qualified non-empty human-readable semantic name
- **THEN** the ordinary product graph SHALL omit that object and its incident edges while the development-only static audit artifact MAY expose the controlled unavailable state
- **AND** neither surface SHALL substitute the object identifier, source locator, English fallback, raw enum, or another system string

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
The product QA capture and governance gate SHALL validate active API/provenance identity using booleans or field counts only, including equality between source release identity and provenance authority identity plus complete snapshot and activation fields, and SHALL NOT persist release, snapshot, hash, activation, projection, node, relation or locator values in active browser evidence. Active visual evidence SHALL prove non-empty semantic nodes, at least one rendered published edge, renderer-independent endpoint resolution, Force Graph interaction, and active/old mode isolation without requiring SVG DOM geometry. Student, teacher and administrator active views SHALL each pass the same forbidden-surface scan using the current active API response's internal token set plus fixed category vocabulary across text, accessible names/descriptions, title/tooltip and copy interaction payloads, while recording counts rather than matched values.

All API evidence written by the capture SHALL pass through one strict allowlist projector with the exact `safe-api-evidence/v1` shape: fixed `roleClass`; a `sequence` containing only `endpointClass` (`active-canvas`, `active-node`, `legacy`, or `candidate`), numeric `status`, and positive `requestCount`; and exactly the boolean checks `activeNodeRequestObserved`, `activeCanvasIdentityVerified`, `activeNodeIdentityVerified`, `provenanceIdentityVerified`, `roleRequestIsolationVerified`, and `forbiddenDataAbsent`. Real requests and responses MAY remain in capture memory only. The projector and gate SHALL fail closed for unknown Knowledge API endpoints, unknown fields, duplicate endpoint classes, URL/path/query/route/request/response/header/cookie/source-locator/raw-enum/API-identity values, node/relation counts, object fingerprints, dynamic opaque tokens and URI-encoded or decoded token variants. The gate SHALL independently assert active isolation from endpoint classes, status and request counts, not only from the boolean checks. Legacy and candidate SHALL remain fixed classifications with their existing product-state evidence; tasks 4.2 and 4.3 remain unchecked until this contract passes on a clean committed revision with real credentials.

The checks object SHALL also contain required `activeNodeRequestObserved`. Its pair with `activeNodeIdentityVerified` SHALL be exactly false/false when no active-node request was observed, true/false when an observed request failed status, endpoint/selected-node equality or provenance verification, and true/true only for a matching 200 active-node response; false/true SHALL be rejected. The authenticated student/teacher/administrator detail records and the desktop-dark detail state SHALL require an active-node sequence entry with status 200 and positive request count plus true/true. Responsive records without detail interaction SHALL explicitly contain false/false and SHALL NOT inherit node verification from another record.

The capture and gate SHALL share one deterministic `SensitiveValueMatcher` for raw, URI-encoded and once-decoded variants. It SHALL scan API artifact string leaves/JSON bytes and active product text, accessibility content, title/tooltip and copy payloads, and SHALL persist only match counts and booleans without matched values or errors.

#### Scenario: Active visual evidence is captured
- **WHEN** the active product QA matrix captures a responsive state
- **THEN** the evidence SHALL contain at least one semantic node and one published edge whose source and target resolve to currently rendered nodes, plus verified wheel zoom and pan behavior in the shared Force Graph runtime
- **AND** the evidence SHALL record one semantic detail or adjacency interaction with focus returned to a semantic node or the graph canvas
- **AND** the interaction evidence SHALL independently record focus on the semantic node before activation, focus on the detail panel after open, and focus on the originating semantic node or semantic canvas after close or Escape

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
The active domain's initial server response SHALL remain bounded, while every presentable, authorized, supported node type that has already been materialized SHALL be enabled by default. Formula, KnowledgeStatement, DomainConcept, SystemModel, and future registered types SHALL remain independently reversible through the compact node-type legend; server-bounded search and one-hop exploration SHALL reach objects not yet materialized.

#### Scenario: Dense domain is opened
- **WHEN** a bounded domain shard materializes several registered object types
- **THEN** every qualified materialized type SHALL be visible by default within the bounded view
- **AND** the viewer SHALL be able to disable and re-enable each type without resetting coordinates, viewport, relation filters, selection, or the inspector

### Requirement: Current Authority detail includes governed learning media
The current Authority node detail SHALL include eligible Knowledge Card content and accepted infographs when available and authorized. Long-form learning media SHALL remain in the inspector and SHALL NOT replace semantic nodes or published relation topology on the canvas. Optional media SHALL be read only from a v2 learning-content manifest whose sealed Authority identity exactly matches the selected detail shard; an identity mismatch SHALL not suppress the semantic node detail.

#### Scenario: Node detail has governed media
- **WHEN** a selected Authority object has eligible card and infograph projections
- **THEN** the inspector SHALL present them after semantic identity and explanation
- **AND** the canvas SHALL remain the primary graph representation

#### Scenario: Governed media is unavailable
- **WHEN** the selected object has no eligible card or infograph, or the current shard Teaching binding is unavailable
- **THEN** semantic detail and published relation summaries SHALL remain available
- **AND** the UI SHALL omit the unavailable media panels and not expose internal asset or review identity

### Requirement: Every Authority surface uses the localized presentation record

Root, domain, relation-family, neighborhood, search, node detail, accessibility,
knowledge-card, and infograph surfaces MUST use the same resolved display label
and aliases for a selected Authority snapshot. Association and requests MUST
continue to use internal stable identity.

#### Scenario: A learner opens a localized node

- **WHEN** a visible node has a resolved Chinese primary label
- **THEN** the canvas, search result, accessible name, and inspector SHALL show
  the same Chinese label without exposing its internal ID

#### Scenario: A card is opened from a localized node

- **WHEN** the learner selects its knowledge card or infograph
- **THEN** the media SHALL be resolved by stable identity while the inspector
  retains the localized human-facing label

### Requirement: New graph follows the established legacy graph interaction contract
The active Authority product view SHALL use the same established old-graph Force Graph implementation for the full workspace canvas, 2D and 3D modes, compact typed node glyphs, external node labels, dynamic relation emphasis, wheel and touch zoom, pan, drag and pin, force reflow, hover preview, reversible filters, focus return, and stable inspection. Sharing that implementation MUST NOT combine active Authority and old graph API responses, nodes, relations, loaded shards, force coordinates, viewport, filters, selection, detail state, or caches. The product SHALL NOT retain a second user-reachable active canvas runtime.

#### Scenario: User enters a new graph domain
- **WHEN** the new graph renders a bounded domain subgraph
- **THEN** the graph canvas SHALL occupy the available workspace and support the same primary 2D and 3D interactions as the old graph
- **AND** the active view SHALL continue to use only active Authority shard data and matched formal projections

#### Scenario: User switches between graph versions
- **WHEN** the user switches from one graph version to the other and later returns
- **THEN** each destination SHALL restore its own API data, force layout, viewport, filters, selection, and detail state
- **AND** no state or cached response from the other version SHALL be merged or matched by name, type, or similarity

### Requirement: New graph nodes use compact glyphs with external readable labels
Ordinary active Authority nodes SHALL use their registered shape, color, and accessible description to communicate type. The visible semantic name SHALL appear below the glyph with bounded multiline wrapping, and the canonical type label SHALL NOT be repeated as visible text inside the glyph.

#### Scenario: Ordinary node renders
- **WHEN** a presentable Authority object enters the domain canvas
- **THEN** its compact glyph SHALL encode the registered type and its complete bounded semantic label SHALL render below the glyph
- **AND** no visible type caption SHALL occupy the glyph interior

#### Scenario: Node name exceeds one line
- **WHEN** the semantic name does not fit the approved single-line label width
- **THEN** the label SHALL wrap across the bounded number of lines without an arbitrary character slice
- **AND** it SHALL remain readable without overlapping its own glyph or an immediately adjacent label at the accepted layout bounds

### Requirement: Product graph version names hide internal implementation titles
The ordinary graph-version switch SHALL label the active Authority product view as `新版` and the historical Legacy product view as `旧版`. Internal `Authority` and `Legacy` names SHALL remain confined to API names, diagnostics, test hooks, and logs and MUST NOT appear as the ordinary switch labels or their accessible names.

#### Scenario: Ordinary user reads the graph switch
- **WHEN** the knowledge workspace renders its product graph-version controls
- **THEN** the two ordinary options SHALL be named `新版` and `旧版`
- **AND** internal Authority or Legacy names SHALL not be exposed by visible or accessible control text

#### Scenario: Administrator opens candidate diagnostics
- **WHEN** an authorized administrator opens the independent candidate diagnostic mode
- **THEN** any explicit diagnostic identity SHALL remain confined to that controlled surface
- **AND** it SHALL not become a third ordinary version name or alter the `新版` and `旧版` meanings

### Requirement: Active Authority mathematical expressions use the governed LaTeX renderer
Every user-visible mathematical expression supplied through qualified Authority rich text, a trusted Formula field, or governed Knowledge Card content SHALL use the shared LaTeX/KaTeX presentation contract. Formulaized node titles SHALL render as governed mathematics in 2D, 3D, hover and keyboard preview, search and filter results, accessibility projections, and inspector titles. Descriptions and card content SHALL preserve published inline or block display semantics. Arbitrary prose MUST NOT be guessed to be TeX. An Authority sidecar math-rendering failure MUST preserve neighboring text and use its reviewed bounded unavailable state without exposing raw source values; an unregistered Authority failure MUST block target product qualification. An ACT-authored Markdown formula failure MUST block that content's formal publication until its content or shared renderer compatibility is repaired and MUST NOT inherit an Authority disposition.

#### Scenario: Formulaized title appears across graph surfaces
- **WHEN** a presentable Authority node has a qualified title containing inline math spans
- **THEN** its 2D and 3D labels, preview, search result, accessible name, and inspector title SHALL present the same governed text-and-math sequence
- **AND** no surface SHALL replace the math span with raw TeX, a plain-text approximation, or a separately parsed label

#### Scenario: Graph zoom changes label visibility
- **WHEN** zoom level or node density causes ordinary titles to hide or reappear
- **THEN** formula and non-formula portions of the same title SHALL hide and reappear together under the same level-of-detail rule
- **AND** formula content SHALL NOT have a separate visibility threshold

#### Scenario: Formula node detail contains a reviewed expression
- **WHEN** the selected Authority Formula supplies trusted mathematical content
- **THEN** the expression SHALL render as formatted mathematics through the shared governed renderer with current-locale accessibility
- **AND** an explicit valid-formula copy action SHALL return trusted delimiter-free LaTeX rather than rendered HTML

#### Scenario: Knowledge content contains declared math blocks
- **WHEN** a governed Knowledge Card contains declared inline or block mathematical nodes
- **THEN** each node SHALL use the shared LaTeX rendering and macro contract while the card remains Markdown-authored
- **AND** surrounding prose SHALL remain ordinary escaped text or governed Markdown

#### Scenario: Knowledge Card formula cannot render
- **WHEN** an ACT-authored Knowledge Card formula fails shared syntax, macro, safety, or rendering validation
- **THEN** the card SHALL remain development-only until the content or shared renderer compatibility is repaired
- **AND** the failure SHALL NOT receive or reuse an ActKG Authority unavailable disposition

#### Scenario: Registered formula is unavailable
- **WHEN** a math span has a matching course-owner-approved unavailable disposition
- **THEN** only that span SHALL use its safe fallback while neighboring text and unrelated detail remain available
- **AND** a title that no longer has meaningful governed identity SHALL follow the unavailable-name review contract

### Requirement: Active node hover provides a bounded non-destructive preview
Hovering or keyboard-previewing a presentable active node SHALL expose its human-readable name, registered type, short explanation, and bounded availability summary without changing selection, layout, viewport, filters, or drawer state. Hover preview SHALL NOT load long-form content or replace keyboard-accessible selection.

#### Scenario: Viewer hovers a node
- **WHEN** a pointer rests on a presentable active node
- **THEN** a rapid bounded preview SHALL appear using already available safe fields
- **AND** leaving the node SHALL dismiss the preview without opening or changing the selected-node drawer

#### Scenario: Keyboard user explores a node
- **WHEN** a keyboard user focuses a semantic node
- **THEN** equivalent bounded preview information SHALL be available through the accessible interaction contract
- **AND** explicit activation SHALL remain the action that opens the detail drawer

### Requirement: Active Authority exposes exactly three progressive graph levels
The ordinary active workspace SHALL present three explicit levels: line-free top-level domain navigation, a selected domain's bounded DomainConcept overview, and a selected concept or search result's published one-hop semantic network. Desktop and mobile SHALL apply the same level semantics and MUST NOT flatten secondary types into the domain overview.

#### Scenario: Viewer enters a domain
- **WHEN** a viewer selects a ready root domain
- **THEN** the canvas SHALL show only that domain's bounded DomainConcept overview
- **AND** Formula, KnowledgeStatement, SystemModel and ModelRepresentation nodes SHALL remain undisclosed until search or one-hop exploration

#### Scenario: Viewer selects a domain concept
- **WHEN** the viewer activates one visible concept
- **THEN** the canvas SHALL materialize its bounded published one-hop network as the third level
- **AND** every displayed edge SHALL retain its exact source relation and endpoints

#### Scenario: Viewer returns to the domain overview
- **WHEN** the viewer leaves a selected neighborhood
- **THEN** the same domain's concept overview, filters and viewport state SHALL be restored
- **AND** undisclosed secondary nodes SHALL not remain flattened into the overview

### Requirement: Formula canvas identity presents mathematics rather than prose substitution
A visible Formula node SHALL present its governed mathematical expression as the primary canvas label and its governed human name as bounded supporting context. A prose-only title MUST NOT be treated as complete Formula canvas presentation.

#### Scenario: Viewer discloses a Formula neighbor
- **WHEN** a concept's published one-hop network contains a Formula
- **THEN** the canvas SHALL show the formatted expression with its Formula glyph and bounded human context
- **AND** search, hover, accessibility and inspector SHALL resolve the same stable object identity

### Requirement: Domain concept labels are readable before selection
The bounded domain overview SHALL present the complete governed name of ordinary DomainConcept nodes without requiring selection or hover. Force separation, camera fit and label collision SHALL jointly satisfy an explicit default visible-label ratio on desktop; on mobile the selection-independent readable-name channel for large domains is the browsable node directory, because fitting hundreds of concepts into a phone viewport leaves nodes at pixel scale where readable canvas labels are geometrically impossible.

#### Scenario: Domain overview becomes usable
- **WHEN** the force layout reaches its accepted settlement milestone
- **THEN** the configured minimum proportion of DomainConcept labels SHALL be visible and readable on desktop
- **AND** ordinary labels SHALL not be reduced to selected-only or hovered-only presentation on either surface

#### Scenario: Mobile large-domain overview stays identifiable
- **WHEN** a bounded overview larger than the compact threshold is fitted on a mobile viewport
- **THEN** the browsable node directory SHALL remain the selection-independent readable-name channel
- **AND** a selected concept's canvas label SHALL stay visible through the viewport clamp fallback

#### Scenario: Density prevents one label
- **WHEN** one label cannot fit after force separation and camera fitting
- **THEN** the LOD policy MAY defer that label while preserving its accessible name
- **AND** the evidence SHALL record the deferred count against the accepted budget

### Requirement: Every active graph surface follows the selected qualified locale
Root navigation, domain concepts, secondary nodes, relation terms, formula context, search, filter controls, hover, inspector, optional-content availability and accessibility SHALL use the same selected qualified locale. Stable object, relation, resource and launch identities SHALL not change with locale.

#### Scenario: English frame is displayed
- **WHEN** the active graph commits a qualified English generation
- **THEN** no user-visible or accessible Authority/ACT interface string SHALL remain Chinese except explicitly quoted source content with declared language
- **AND** graph topology and interaction state SHALL remain unchanged

#### Scenario: Optional block lacks English
- **WHEN** an ACT-owned card or resource body does not declare English availability
- **THEN** the English inspector SHALL omit it or show the bounded English unavailable state
- **AND** it SHALL not inject the Chinese body into the English graph

### Requirement: Node types are independently reversible without hierarchy collapse
Every registered node type already materialized in the current third-level network SHALL have an independent reversible filter. Toggling a secondary type SHALL NOT promote that type into the domain overview or require all objects of that type to be loaded.

#### Scenario: Formula visibility is toggled
- **WHEN** a one-hop network contains Formula nodes and the viewer hides Formula
- **THEN** those nodes and incident visible edges SHALL be hidden while the concept overview and other types remain
- **AND** re-enabling Formula SHALL restore the same materialized identities and state

### Requirement: Semantic graph completion is checked across every domain
Final acceptance SHALL verify each visible root domain has a bounded DomainConcept overview and at least one valid selected-neighborhood path or an explicitly verified relation-empty concept state. Seven missing-domain defaults or any client-flattened complete domain SHALL block completion.

#### Scenario: Domain coverage gate runs
- **WHEN** the active root advertises its domain catalog
- **THEN** every entry SHALL pass default-shard, hierarchy, search and detail closure checks
- **AND** no subset constant SHALL be accepted as the full denominator

