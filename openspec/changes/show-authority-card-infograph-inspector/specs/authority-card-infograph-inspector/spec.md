## ADDED Requirements

### Requirement: Selected Authority nodes open a stable learning inspector
Selecting a presentable Authority object SHALL open or update a stable desktop side panel or mobile sheet containing its human-readable name, registered type label, explanation and relation summary. The graph SHALL retain its domain, layout, filters and loaded shards.

#### Scenario: User selects a domain object
- **WHEN** pointer or keyboard activation selects an Authority object
- **THEN** the inspector SHALL open with sanitized semantic detail while the node remains selected
- **AND** the canvas SHALL not be replaced by a card grid

### Requirement: Accepted Knowledge Cards and infographs load on demand
The inspector SHALL request eligible Knowledge Card content and accepted infograph metadata only after node selection. Accepted cards and infographs SHALL be presented as learning content; missing cards, blocked drafts and unavailable media SHALL use controlled human-readable states.

#### Scenario: Node has an accepted card and infograph
- **WHEN** the selected node resolves to an authorized published card and accepted infograph
- **THEN** the inspector SHALL show the card content and provide the infograph at responsive readable dimensions
- **AND** neither asset SHALL have been included in the root or domain-default shard

#### Scenario: Card is draft-blocked
- **WHEN** the selected node's card is not eligible for publication
- **THEN** the product SHALL not display the draft as reviewed knowledge
- **AND** it SHALL use controlled availability wording without exposing the raw review state

#### Scenario: Infograph fails to load
- **WHEN** an otherwise eligible infograph cannot be retrieved
- **THEN** the card and semantic node detail SHALL remain usable
- **AND** the media error SHALL not expose a path, object key or hash

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
