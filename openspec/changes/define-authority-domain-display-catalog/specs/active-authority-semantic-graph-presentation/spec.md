## MODIFIED Requirements

### Requirement: Current Authority is rendered as a semantic node-link graph
The current Authority product workspace SHALL first render reviewed presentation-only domain navigation nodes and, after domain entry, SHALL render authoritative objects as compact semantic nodes with published teaching or engineering relations as connecting edges on an interactive graph canvas. Presentation-only domain and aggregate nodes SHALL be explicitly separated from Authority objects and SHALL NOT create, imply or persist engineering or teaching facts. The workspace SHALL NOT use an object card grid or a relation card list as the primary graph representation.

#### Scenario: Viewer opens current Authority
- **WHEN** an entitled viewer opens a ready current Authority workspace
- **THEN** the primary content SHALL be a pannable, zoomable and selectable node-link canvas whose first level contains reviewed human navigation domains
- **AND** object cards and relation cards SHALL NOT replace the canvas topology
- **AND** domain or aggregate navigation geometry SHALL NOT be counted or described as Authority topology

#### Scenario: Viewer enters a domain
- **WHEN** a viewer activates a reviewed domain navigation node
- **THEN** the canvas SHALL show real Authority objects and only published teaching or engineering relations eligible for that domain view
- **AND** no presentation membership or summary edge SHALL be represented as an Authority fact

#### Scenario: Viewer selects a graph node
- **WHEN** a viewer selects a visible Authority semantic node
- **THEN** the canvas SHALL emphasize that object and its visible published relations
- **AND** long-form content SHALL appear in a separate detail panel rather than inside the node glyph
