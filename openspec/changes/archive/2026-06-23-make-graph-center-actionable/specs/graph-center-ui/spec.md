## MODIFIED Requirements

### Requirement: Graph center exposes read-only K/A/Q graph exploration
The system SHALL provide a graph-center surface that can display knowledge, capability, and quality graph domains from structured graph payloads and expose authorized actions from selected nodes.

#### Scenario: User opens graph center
- **WHEN** a user opens the graph-center route
- **THEN** the page SHALL render in AppShell
- **AND** it SHALL expose knowledge, capability, and quality graph-domain switching
- **AND** selected-node details SHALL expose role-scoped actions when path, resource, overlay, citation, diagnosis, prep-pack, or audit targets are available.

### Requirement: Graph center has accessible non-canvas fallback
The graph-center surface SHALL provide an inspectable list/detail path in addition to graph rendering, including authorized actions.

#### Scenario: User cannot use graph canvas directly
- **WHEN** the viewport is mobile or keyboard interaction is used
- **THEN** graph nodes SHALL remain reachable through a list, table, or equivalent detail navigation
- **AND** node details SHALL have explicit headings, labels, status text, action labels, and disabled/degraded reasons where actions are not available.
