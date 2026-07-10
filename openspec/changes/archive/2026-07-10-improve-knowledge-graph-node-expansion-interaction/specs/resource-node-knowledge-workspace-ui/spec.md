## ADDED Requirements

### Requirement: Knowledge graph expansion controls follow selected nodes
The knowledge graph SHALL expose the primary expand/collapse control near the
selected graph node instead of relying on a distant fixed panel as the only
expansion entry.

#### Scenario: User selects an expandable top-level node
- **WHEN** a user selects a top-level or collapsed root graph node that can load or reveal a local subgraph
- **THEN** the graph SHALL show an accessible expand/collapse control near that selected node
- **AND** the control SHALL remain within the graph viewport bounds
- **AND** the control SHALL expose collapsed, loading, expanded, disabled, and focus states through visible text or accessible labels.

#### Scenario: User expands a node
- **WHEN** the user activates the node-local expansion control
- **THEN** the selected node's local subgraph SHALL load or reveal without requiring the user to find a separate bottom-screen control
- **AND** the selected-node status panel MAY show context or loading status but SHALL NOT be the only available expansion control.

#### Scenario: User navigates with keyboard
- **WHEN** a selected node has an expansion control
- **THEN** the control SHALL be reachable by keyboard focus
- **AND** activating it SHALL produce the same expand/collapse behavior as pointer activation.

### Requirement: Expanded graph neighborhoods are centered on the expanded node
The knowledge graph SHALL arrange direct expansion children around the node that
was expanded so the result reads as a local concept map rather than a distant
edge fan.

#### Scenario: Top-level unit node is expanded
- **WHEN** a top-level unit or collapsed root node is expanded
- **THEN** its direct child nodes SHALL be placed around the expanded node using deterministic radial, ring, or equivalent centered placement
- **AND** the expanded node SHALL remain visually central to the child cluster
- **AND** direct child links SHALL remain visible enough to explain membership or local relationship.

#### Scenario: Expanded node has many children
- **WHEN** an expanded node has more direct children than fit in one readable ring
- **THEN** children SHALL spill into stable additional rings or equivalent bounded groups
- **AND** labels and hit targets SHALL remain recoverable without severe overlap.

#### Scenario: User has pinned graph positions
- **WHEN** a user has dragged or pinned graph nodes
- **THEN** focused expansion layout SHALL preserve user-pinned coordinates
- **AND** it SHALL NOT reset unrelated graph layout state during selection, expansion, collapse, hover, or inspector updates.
