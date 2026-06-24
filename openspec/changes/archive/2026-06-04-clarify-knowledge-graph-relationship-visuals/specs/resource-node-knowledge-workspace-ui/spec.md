## ADDED Requirements

### Requirement: Graph relationship lines encode relation meaning
The knowledge graph SHALL render relation lines with distinct visual semantics for prerequisite/foundation, contains, follows/leads-to, applies-to, opposite, and related relations.

#### Scenario: Graph renders multiple relation types
- **WHEN** the graph displays different relation types
- **THEN** each type SHALL use an approved combination of color role, line style, width, arrow behavior, opacity, and legend label
- **AND** relation meaning SHALL remain distinguishable in both light and dark themes without relying on color alone.

### Requirement: Default graph view limits edge density
The knowledge graph SHALL limit default visible edges to high-signal structure and current exploration context.

#### Scenario: Graph opens with many available relations
- **WHEN** the available relation count is high
- **THEN** the default view SHALL show skeleton, hierarchy, prerequisite, follows/leads-to, and selected-context relations before weak related edges
- **AND** weaker relations SHALL be dimmed, collapsed, or hidden until selected through filters or focus interaction.

### Requirement: Graph focus reduces unrelated edge noise
The knowledge graph SHALL dim unrelated edges and emphasize selected-node neighborhoods during hover, selection, or search focus.

#### Scenario: User selects a node
- **WHEN** a node is selected or focused
- **THEN** directly relevant nodes and relations SHALL become visually prominent
- **AND** unrelated edges SHALL reduce opacity enough to make the selected neighborhood readable while preserving orientation.

### Requirement: Relation legend and filters are part of the workspace
The knowledge graph SHALL expose relation legend and filters as workspace controls aligned with the shared shell and floating action dock.

#### Scenario: User changes relation filters
- **WHEN** a user toggles relation families, density, or weak-edge visibility
- **THEN** the graph SHALL update without losing selected node context, panel state, or ResourceNode-aware launch actions
- **AND** controls SHALL not overlap the shared floating action dock.
