# authority-card-infograph-inspector Specification

## Purpose
Present governed, optional Knowledge Cards and accepted infographs in the selected Authority node inspector without changing graph topology or exposing system identities.
## Requirements
### Requirement: Selected Authority nodes open a stable learning inspector
Selecting a presentable Authority object SHALL open or update the established stable desktop side panel or mobile sheet containing its human-readable name, registered type label, explanation, relation summary, eligible active-only metadata, verified cross-domain entrances, and authorized formal-resource summaries. Interaction SHALL remain equivalent to the old graph inspector: stable placement, in-place update when a different node is selected, and explicit close with focus return. Inspector content SHALL resolve from the currently active composite release and matching ACT display, teaching, and resource projections. The graph SHALL retain its domain, force layout, viewport, filters, loaded shards, and hover state.

#### Scenario: User selects a domain object
- **WHEN** pointer or keyboard activation selects an Authority object
- **THEN** the inspector SHALL open with sanitized semantic detail, available boundary entrances, and eligible resource summaries while the node remains selected
- **AND** the canvas SHALL not be replaced by a card grid or embedded resource runtime

#### Scenario: Inspector matches Legacy interaction on active data
- **WHEN** a user selects successive nodes in the same domain view
- **THEN** the inspector SHALL update in place without closing, reopening, or resetting domain, filter, viewport, force layout, or loaded-shard state
- **AND** every displayed field SHALL resolve from the active composite release's matched ACT projections rather than from any old, inactive, candidate, or mismatched catalog

### Requirement: Accepted Knowledge Cards and infographs load on demand
The inspector SHALL request eligible Knowledge Card content and accepted infograph metadata only after node selection. Accepted cards and infographs SHALL be presented as learning content when the v2 learning-content manifest, sealed Authority identity, and Teaching overlay identity match the selected shard envelope. The production-served manifest MUST be the scripted v2 export covering the complete runtime card and infograph file set and carrying the scripted teaching seal (`teachingProjectionId`/`teachingProjectionHash`) of the active overlay; a v1 manifest, a fixture-scale manifest, or a manifest without the scripted seal MUST NOT be served to learners as the production learning-content package. Missing files, hash drift and unmapped objects SHALL fail the learning-content package rather than silently omitting coverage. Draft-blocked cards SHALL be omitted from the product panel without a placeholder that looks reviewed, but they SHALL remain counted as linked in the coverage ledger. Legacy, malformed or duplicate-entry manifests SHALL fail closed before any asset bytes are read.

#### Scenario: Node has an accepted card and infograph
- **WHEN** the selected node resolves to an authorized published card and accepted infograph
- **THEN** the inspector SHALL show the card content and provide the infograph at responsive readable dimensions
- **AND** neither asset SHALL have been included in the root or domain-default shard

#### Scenario: Card is draft-blocked
- **WHEN** the selected node's card is not eligible for publication
- **THEN** the product SHALL not display the draft as reviewed knowledge
- **AND** it SHALL omit the Knowledge Card panel without exposing the raw review state

#### Scenario: Infograph fails to load
- **WHEN** an otherwise eligible infograph cannot be retrieved
- **THEN** the card and semantic node detail SHALL remain usable
- **AND** the infograph panel SHALL be omitted without exposing a path, object key or hash

#### Scenario: Teaching overlay identity matches the shard
- **WHEN** the current Authority shard envelope reports a passed teaching overlay
- **THEN** the resolver SHALL read the v2 manifest sealed to that Authority identity and overlay
- **AND** it SHALL keep semantic detail usable while omitting only assets that are genuinely missing or blocked

#### Scenario: Teaching binding is unavailable
- **WHEN** the current Authority shard envelope does not report a passed teaching overlay
- **THEN** the inspector SHALL not read independently current projection or card inputs
- **AND** it SHALL keep semantic detail usable while omitting card and infograph panels

#### Scenario: Learning export belongs to another Authority identity
- **WHEN** the learning-content manifest was exported for another Authority snapshot or release
- **THEN** the resolver SHALL fail closed for optional card and infograph content before reading their files
- **AND** the selected node's semantic detail SHALL remain usable

#### Scenario: Production serves a stale or unsealed manifest
- **WHEN** the manifest deployed with the runtime release is v1, covers only the git-tracked fixture node set, or lacks the scripted teaching seal
- **THEN** the release chain SHALL fail its pre-activation verification before that manifest is activated
- **AND** if such a manifest nonetheless reaches the runtime, the resolver and readiness classification SHALL fail closed while semantic node detail remains usable

### Requirement: Inspector content hides system identity
Visible text, accessible names and descriptions, tooltips, media alternatives, errors and copy payloads SHALL NOT expose Authority object or relation identifiers, release or projection identifiers, hashes, raw enum values, internal source locators or filesystem paths.

#### Scenario: Detail metadata is incomplete
- **WHEN** a human-readable field or media alternative is unavailable
- **THEN** the inspector SHALL omit it or use a controlled human-readable fallback
- **AND** it SHALL not substitute any internal identity value

### Requirement: Inspector focus and selection are recoverable
Opening the inspector SHALL move focus into its detail surface. Closing by Escape or an explicit control SHALL return focus to the originating semantic node when it remains present, otherwise to the primary graph canvas.

#### Scenario: Mobile user closes node detail
- **WHEN** a mobile user opens a node, reads its card or infograph and closes the sheet
- **THEN** the sheet SHALL detach or become hidden and focus SHALL return to the origin node or graph canvas
- **AND** domain, filters and viewport state SHALL remain unchanged

### Requirement: Inspector presents only eligible source-owned resource launches
The inspector SHALL group eligible formal resources by visual family while preserving each item's exact runtime subtype, human-readable title, teaching role, semantic anchor summary, availability, and source-owned launch action. It SHALL delegate playback, reading, exercise, simulation, project, and other runtime behavior to existing feature-owned launchers or renderers and SHALL NOT embed or recreate those runtimes inside the drawer. Activating a launch item SHALL open the universal resource viewer shell in place by default instead of navigating the whole page away from the graph; the viewer shell SHALL delegate rendering to the same existing launchers or renderers, and the resource's full-page route SHALL remain reachable through the shell's open-full-page action.

#### Scenario: User launches a bound media paragraph
- **WHEN** an authorized video, audio, or podcast binding has a current semantic-paragraph anchor and safe launch descriptor
- **THEN** the inspector SHALL open the universal resource viewer shell and pass its validated `startSeconds` and source-owned resource identity to the existing player contract
- **AND** it SHALL not construct a route from the Canonical Object identity or implement another player

#### Scenario: User launches bound text or an exercise
- **WHEN** an authorized textbook, card, handout, lecture, or exercise binding has a current atomic anchor
- **THEN** the inspector SHALL open the universal resource viewer shell and pass the stable paragraph or question identity to the existing reader or exercise renderer
- **AND** it SHALL not open only the container start when the governed anchor is more precise

#### Scenario: User continues to the full page
- **WHEN** the viewer shell is open for a launched resource and the user activates the open-full-page action
- **THEN** the product SHALL navigate to that resource's existing full-page route in normal access mode
- **AND** the inspector SHALL NOT replace the graph canvas as a side effect of opening the shell

#### Scenario: Resource launch is not eligible
- **WHEN** a binding is development-only, stale, identity-mismatched, unauthorized, lacks a safe launch target, or its launcher cannot consume the governed atomic anchor
- **THEN** the inspector SHALL omit the formal launch item and the node glyph SHALL omit its marker qualification
- **AND** valid semantic detail and unrelated eligible resources SHALL remain usable

### Requirement: Inspector exposes no runtime review operation
The product inspector SHALL NOT display or mutate unavailable-name reviews, candidate bindings, pipeline confidence, pending teaching relations, review-pack contents, failed-resource dispositions, or other development governance state. This change SHALL NOT add a review role, entitlement, online review API, runtime write action, or deployed review route.

#### Scenario: Repository review work remains pending
- **WHEN** the current formal projections exclude unresolved teaching or resource candidates
- **THEN** the runtime inspector SHALL present only admitted relations and resources without review controls or pending-state details
- **AND** repository JSON/JSONL and generated reports SHALL remain outside the runtime response and deploy bundle

#### Scenario: Administrator uses the ordinary node inspector
- **WHEN** an administrator selects a node in the ordinary active graph
- **THEN** the inspector SHALL follow the same no-review-operation boundary
- **AND** elevated role SHALL NOT reveal candidate payloads, confidence, hashes, review packs, or internal source locators

