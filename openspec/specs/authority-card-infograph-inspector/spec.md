# authority-card-infograph-inspector Specification

## Purpose
Present governed, optional Knowledge Cards and accepted infographs in the selected Authority node inspector without changing graph topology or exposing system identities.
## Requirements
### Requirement: Selected Authority nodes open a stable learning inspector
Selecting a presentable Authority object SHALL open or update a stable desktop side panel or mobile sheet containing its human-readable name, registered type label, explanation and relation summary, with interaction behavior equivalent to the Legacy graph inspector: stable placement, in-place update when a different node is selected, and explicit close with focus return. Inspector content SHALL resolve from the currently active composite release and its ACT display projections. The graph SHALL retain its domain, layout, filters and loaded shards.

#### Scenario: User selects a domain object
- **WHEN** pointer or keyboard activation selects an Authority object
- **THEN** the inspector SHALL open with sanitized semantic detail while the node remains selected
- **AND** the canvas SHALL not be replaced by a card grid

#### Scenario: Inspector matches Legacy interaction on active data
- **WHEN** a user selects successive nodes in the same domain view
- **THEN** the inspector SHALL update in place without closing, reopening, or resetting domain, filter or layout state
- **AND** every displayed field SHALL resolve from the active composite release's ACT display projections rather than from any inactive or v0.9 catalog

### Requirement: Accepted Knowledge Cards and infographs load on demand
The inspector SHALL request eligible Knowledge Card content and accepted infograph metadata only after node selection. Accepted cards and infographs SHALL be presented as learning content; missing cards, blocked drafts and unavailable media SHALL be omitted without a placeholder panel. The resolver SHALL accept only a v2 learning-content manifest whose sealed Authority release, release-set, snapshot and snapshot-hash exactly match the selected Authority shard envelope; legacy, malformed, duplicate-entry or mismatched manifests SHALL omit all optional media before any asset bytes are read.

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

#### Scenario: Teaching binding is unavailable
- **WHEN** the current Authority shard envelope does not report a passed, matching Teaching Projection
- **THEN** the inspector SHALL not read independently current projection or card inputs
- **AND** it SHALL keep semantic detail usable while omitting card and infograph panels

#### Scenario: Learning export belongs to another Authority identity
- **WHEN** an otherwise active Teaching Projection selects a canonical object but the learning-content manifest was exported for another Authority identity
- **THEN** the resolver SHALL omit all optional card and infograph content before reading their files
- **AND** the selected node's semantic detail SHALL remain usable

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

