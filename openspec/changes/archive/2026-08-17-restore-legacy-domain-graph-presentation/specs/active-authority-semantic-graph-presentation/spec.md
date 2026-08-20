## MODIFIED Requirements

### Requirement: Current Authority is rendered as a semantic node-link graph
The current Authority product workspace SHALL render authoritative objects as compact semantic nodes and published authoritative relations as connecting edges on an interactive graph canvas at the domain and knowledge levels. The root level SHALL present circular domain navigation entries without any connecting edges, and every edge rendered anywhere in the workspace SHALL represent a real published Authority or teaching relation. It SHALL NOT use an object card grid or a relation card list as the primary graph representation at any level.

#### Scenario: Viewer opens current Authority
- **WHEN** an entitled viewer opens a ready current Authority workspace
- **THEN** the root level SHALL present circular domain navigation and entering a domain SHALL present a pannable, zoomable and selectable node-link canvas
- **AND** object cards and relation cards SHALL NOT replace the canvas topology

#### Scenario: Viewer selects a graph node
- **WHEN** a viewer selects a visible semantic node
- **THEN** the canvas SHALL emphasize that object and its visible authoritative relations
- **AND** long-form content SHALL appear in a separate detail panel rather than inside the node glyph

#### Scenario: Root level draws no edges
- **WHEN** the root level renders its circular domain navigation entries
- **THEN** no edge geometry SHALL connect the entries
- **AND** no presentation-only line SHALL be represented as an Authority fact
