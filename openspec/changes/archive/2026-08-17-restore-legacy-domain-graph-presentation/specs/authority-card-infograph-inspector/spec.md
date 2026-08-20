## MODIFIED Requirements

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
