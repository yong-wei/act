## MODIFIED Requirements

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

### Requirement: Current Authority default view avoids heterogeneous object overload
The active domain's initial server response SHALL remain bounded, while every presentable, authorized, supported node type that has already been materialized SHALL be enabled by default. Formula, KnowledgeStatement, DomainConcept, SystemModel, and future registered types SHALL remain independently reversible through the compact node-type legend; server-bounded search and one-hop exploration SHALL reach objects not yet materialized.

#### Scenario: Dense domain is opened
- **WHEN** a bounded domain shard materializes several registered object types
- **THEN** every qualified materialized type SHALL be visible by default within the bounded view
- **AND** the viewer SHALL be able to disable and re-enable each type without resetting coordinates, viewport, relation filters, selection, or the inspector

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

## ADDED Requirements

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
