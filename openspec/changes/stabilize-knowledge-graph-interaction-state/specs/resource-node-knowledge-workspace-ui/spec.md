## ADDED Requirements

### Requirement: Knowledge graph interactions preserve layout stability
The knowledge graph SHALL keep layout state stable when users hover, select, or inspect nodes.

#### Scenario: User hovers over a node
- **WHEN** the pointer hovers over a graph node
- **THEN** the graph MAY show a lightweight name preview and local visual emphasis
- **AND** hover SHALL NOT rebuild filtered graph data, change relation density, rerun layout, reheat the force simulation, or trigger automatic camera movement.

#### Scenario: User moves across many nodes quickly
- **WHEN** pointer movement emits many hover events across graph nodes
- **THEN** hover preview updates SHALL be throttled, debounced, or renderer-local enough to avoid visible jitter
- **AND** high-frequency hover SHALL NOT change layout version, filtered graph membership, or assistant durable context.

#### Scenario: User selects a node
- **WHEN** the user clicks or otherwise selects a graph node
- **THEN** the graph SHALL update selected styling and inspector context
- **AND** selection SHALL NOT recreate graph node objects, rerun radial or force layout, reset user-positioned nodes, or call fit-to-view without an explicit user action.

#### Scenario: User opens or closes the node inspector
- **WHEN** the selected-node inspector opens, closes, or updates content for another node
- **THEN** graph layout coordinates SHALL remain stable
- **AND** the inspector transition SHALL NOT redistribute unrelated graph nodes.

### Requirement: Knowledge graph drag state is explicit and recoverable
The knowledge graph SHALL preserve user-dragged node positions until the user or a real graph data change requests a new layout.

#### Scenario: User drags a node
- **WHEN** the user drags a node and releases it
- **THEN** the final coordinates SHALL be stored by node id as user-positioned or pinned layout state
- **AND** subsequent hover, selection, and inspector updates SHALL preserve those coordinates.

#### Scenario: User requests layout reset
- **WHEN** the user activates an explicit relayout, reset, or clear-pins command
- **THEN** the graph MAY recompute layout
- **AND** the UI SHALL make the change intentional rather than treating it as a side effect of normal inspection.

#### Scenario: Filters change the visible graph
- **WHEN** relation filters, chapter filters, or density mode changes hide or show graph nodes
- **THEN** visible user-positioned nodes SHALL retain their stored coordinates where possible
- **AND** the layout system SHALL not erase pinned positions unless the node is no longer part of the current graph data or the user resets layout.
