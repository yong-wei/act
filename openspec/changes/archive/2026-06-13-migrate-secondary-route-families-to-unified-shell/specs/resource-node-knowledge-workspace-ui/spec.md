## ADDED Requirements

### Requirement: Knowledge graph tools are collapsible local tools
The knowledge workspace SHALL expose chapter directory, relation filters, legend, view switch, and resource panel as collapsible or drawer-based local tools.

#### Scenario: Desktop knowledge graph opens
- **WHEN** `/knowledge` renders on a desktop viewport
- **THEN** the graph SHALL expose relation filters and chapter directory through local tool panels with visible open and closed states
- **AND** the graph canvas SHALL remain usable when those tools are closed.

#### Scenario: Mobile knowledge graph opens
- **WHEN** `/knowledge` renders at mobile width
- **THEN** chapter directory, relation filters, legend, view switch, and resource details SHALL open through a drawer, sheet, or focused tool panel
- **AND** scattered permanent controls SHALL NOT block the graph canvas or floating dock.

### Requirement: Knowledge graph panels use platform token roles
Knowledge graph local panels SHALL use platform semantic token roles instead of page-local Tailwind color families or unregistered accent palettes.

#### Scenario: Resource panel displays node metadata
- **WHEN** the knowledge resource panel renders node type, Bloom level, knowledge dimension, chapter, difficulty, importance, source quality, or launch state
- **THEN** badge, border, background, and text colors SHALL use approved platform token roles
- **AND** local `slate`, `sky`, `cyan`, `amber`, `emerald`, `fuchsia`, or raw hex palettes SHALL NOT be introduced on migrated lines.

### Requirement: Active knowledge filters remain visible when collapsed
The knowledge workspace SHALL preserve filter state visibility when local tools are collapsed.

#### Scenario: User collapses relation filters
- **WHEN** a user has active relation types, chapter filters, density mode, strength threshold, or connected-node filters and closes the filter panel
- **THEN** the closed tool affordance SHALL summarize active filter state
- **AND** reopening the tool SHALL preserve selected node, visible graph state, and resource panel context.
