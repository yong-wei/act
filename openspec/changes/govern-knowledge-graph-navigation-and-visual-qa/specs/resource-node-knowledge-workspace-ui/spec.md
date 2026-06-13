## ADDED Requirements

### Requirement: Knowledge graph local tools open from compact default controls
The knowledge workspace SHALL expose chapter directory, relation filters, relation legend, view switch, and resource panel as compact default controls rather than permanent desktop panels.

#### Scenario: Desktop knowledge graph first renders
- **WHEN** `/knowledge` first renders on a desktop viewport
- **THEN** the chapter directory, relation filters, relation legend, view switch, and resource panel SHALL be collapsed or compacted into discoverable local tool controls unless a selected-node resource panel is explicitly opened by the user
- **AND** the graph canvas SHALL receive the primary visible area by default.

#### Scenario: User opens graph tools
- **WHEN** the user opens chapter directory, relation filters, legend, or view controls
- **THEN** the opened control SHALL preserve graph context, selected node state, active filters, density mode, legend mode, and visible summaries
- **AND** closing the control SHALL restore the compact canvas-first layout.

#### Scenario: Graph renders at tablet width
- **WHEN** `/knowledge` renders at an intermediate viewport between mobile and desktop breakpoints
- **THEN** local tools SHALL use the same compact or drawer-based behavior as the nearest safe canvas-first layout
- **AND** the layout SHALL NOT create a third state where permanent panels squeeze the graph canvas.
