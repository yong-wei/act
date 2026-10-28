## ADDED Requirements

### Requirement: Domain layout reserves space for readable labels

The domain concept overview layout SHALL reserve spacing for each node's glyph and its external label so that the settled first frame meets the workspace clarity bounds without relying on runtime force settling.

#### Scenario: Dense domain opens

- **WHEN** a domain with dozens of concepts opens at 1440×900
- **THEN** no two node glyphs SHALL overlap
- **AND** visible label boxes SHALL overlap each other for no more than five percent of visible labels.

#### Scenario: Disconnected concepts are placed

- **WHEN** a domain contains concepts without visible relations
- **THEN** they SHALL be placed in a compact deterministic band adjacent to the connected cluster rather than scattered across the canvas.

### Requirement: Selection-priority labels still avoid collisions

When a node is selected, the selected node's label SHALL always render, and focus-neighbour labels SHALL be placed with collision avoidance; a neighbour label that cannot be placed without overlap SHALL be deferred to hover or the inspector rather than drawn on top of another label.

#### Scenario: Node with many neighbours is selected

- **WHEN** the user selects a node whose one-hop neighbours are close together
- **THEN** the selected label SHALL be visible
- **AND** no two rendered neighbour labels SHALL overlap each other or the selected label.
