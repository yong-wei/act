## ADDED Requirements

### Requirement: Knowledge graph default view prioritizes readable structure
The knowledge graph SHALL open in a high-signal view that exposes conceptual structure before weak relationship density.

#### Scenario: Graph opens with many relations
- **WHEN** the graph has more relations than can be read at the current viewport
- **THEN** the default view SHALL prioritize skeleton, hierarchy, prerequisite/foundation, contains, follows/leads-to, and selected-context relations
- **AND** weak related edges SHALL be hidden, faded, or deferred until the user selects a denser mode.

### Requirement: Knowledge graph focus reveals logical neighborhoods
The knowledge graph SHALL make selected-node neighborhoods readable by reducing unrelated graph noise.

#### Scenario: User selects a node
- **WHEN** a node is selected
- **THEN** directly relevant nodes and relations SHALL become visually prominent
- **AND** unrelated nodes and relations SHALL reduce opacity or visibility enough that the selected neighborhood remains readable.

### Requirement: Knowledge graph layout has measurable clarity bounds
The knowledge graph SHALL expose testable clarity behavior for node size, visible edge density, label visibility, and overlap.

#### Scenario: Layout clarity is validated
- **WHEN** automated or manual visual QA checks a representative graph state
- **THEN** the check SHALL verify bounded node size, bounded visible edge density, recoverable label visibility, and selected-neighborhood readability
- **AND** accepting a graph as migrated SHALL NOT rely only on the presence of graph DOM nodes.

### Requirement: Dense relation modes remain user controlled
The knowledge graph SHALL allow learners to request denser relation views without making dense views the default.

#### Scenario: User requests all relations
- **WHEN** the user selects an all-relations or equivalent density mode
- **THEN** the graph MAY show weak and non-structural edges
- **AND** the UI SHALL make the dense mode explicit and reversible without losing selected node context.

#### Scenario: User returns from dense mode
- **WHEN** the user returns from all-relations mode to the default or focused mode
- **THEN** the graph SHALL restore the appropriate high-signal relation set
- **AND** selected node, active filters, density mode state, and visible summaries SHALL remain consistent.
