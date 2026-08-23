## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Inspector presents only eligible source-owned resource launches
The inspector SHALL group eligible formal resources by visual family while preserving each item's exact runtime subtype, human-readable title, teaching role, semantic anchor summary, availability, and source-owned launch action. It SHALL delegate playback, reading, exercise, simulation, project, and other runtime behavior to existing feature-owned launchers or renderers and SHALL NOT embed or recreate those runtimes inside the drawer.

#### Scenario: User launches a bound media paragraph
- **WHEN** an authorized video, audio, or podcast binding has a current semantic-paragraph anchor and safe launch descriptor
- **THEN** the inspector SHALL pass its validated `startSeconds` and source-owned resource identity to the existing player contract
- **AND** it SHALL not construct a route from the Canonical Object identity or implement another player

#### Scenario: User launches bound text or an exercise
- **WHEN** an authorized textbook, card, handout, lecture, or exercise binding has a current atomic anchor
- **THEN** the inspector SHALL pass the stable paragraph or question identity to the existing reader or exercise renderer
- **AND** it SHALL not open only the container start when the governed anchor is more precise

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
