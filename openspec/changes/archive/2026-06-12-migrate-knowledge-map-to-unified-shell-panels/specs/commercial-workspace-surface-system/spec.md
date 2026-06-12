## ADDED Requirements

### Requirement: Knowledge map local panels are workspace controls
Knowledge graph chapter directories, relation filters, legends, view toggles, and node resource panels SHALL render as local workspace controls rather than platform navigation.

#### Scenario: Knowledge graph renders on desktop
- **WHEN** `/knowledge` renders at a desktop viewport
- **THEN** AppShell SHALL provide the platform route navigation and route trace
- **AND** graph-specific chapter directories and filters SHALL be visually subordinate local panels using platform tokens
- **AND** local graph panels SHALL NOT duplicate or visually compete with platform navigation.

#### Scenario: Knowledge graph renders on mobile
- **WHEN** `/knowledge` renders at 320px width
- **THEN** graph-specific directories, filters, and legends SHALL move into explicit drawer, sheet, tab, or command surfaces
- **AND** the graph canvas or primary graph task SHALL remain reachable without reading through a fixed desktop sidebar.

#### Scenario: Graph data marks need domain colors
- **WHEN** relation edges, node categories, or graph density states need color encoding
- **THEN** those colors SHALL be treated as chart or graph data marks
- **AND** shell, panel, filter, and navigation surfaces SHALL use platform semantic tokens rather than route-local raw palette values.
