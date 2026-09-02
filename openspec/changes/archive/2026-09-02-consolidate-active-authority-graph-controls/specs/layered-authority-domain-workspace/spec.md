## ADDED Requirements

### Requirement: Active semantic filters live in one dedicated panel
The active workspace SHALL provide one responsive filter panel containing reversible multi-select node-type and relation-family controls with registered visual samples. The global workspace toolbar SHALL contain only graph-version, language, dimension, fit, reflow and domain-return actions.

#### Scenario: Viewer opens filters on desktop
- **WHEN** the viewer opens the active filter control
- **THEN** one bounded panel SHALL show node types and relation families with their current states and visual meanings
- **AND** search or layout controls SHALL not be duplicated inside unrelated floating rows

#### Scenario: Viewer opens filters on mobile
- **WHEN** the same control is opened on a compact viewport
- **THEN** an accessible drawer SHALL expose the same state and actions
- **AND** closing it SHALL restore focus without changing the graph

### Requirement: Ordinary active graph has no visible all-node directory
The active canvas SHALL NOT render a visible grid or list containing all materialized nodes as a fallback for missing Teaching relations, zero visible edges or formula availability. Semantic node controls SHALL remain screen-reader accessible and bounded discovery SHALL remain available through search.

#### Scenario: Teaching projection is unavailable
- **WHEN** a domain concept overview has no Teaching edges
- **THEN** the canvas and explicit empty-state/filter controls SHALL remain the visible product surface
- **AND** no bottom all-node directory SHALL appear
