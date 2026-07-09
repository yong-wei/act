## ADDED Requirements

### Requirement: Knowledge graph expansion visual QA verifies local controls and centered layout
Commercial UI governance SHALL require visual evidence for knowledge graph
expansion interaction changes.

#### Scenario: Knowledge graph expansion interaction changes
- **WHEN** a PR changes `/knowledge` node expansion controls, selected-node expansion state, or expanded-neighborhood layout
- **THEN** visual evidence SHALL include a selected collapsed node with the node-local expansion control visible
- **AND** it SHALL include the expanded state with child nodes centered around the expanded node
- **AND** it SHALL include the collapsed-again state or equivalent proof that unrelated graph layout remains stable.

#### Scenario: Expansion evidence is reviewed
- **WHEN** visual evidence for knowledge graph expansion is reviewed
- **THEN** the reviewer SHALL check light and dark theme readability, desktop and narrow viewport behavior where practical, keyboard focus visibility, local tool and floating dock non-overlap, and absence of stretched edge-fan layouts
- **AND** screenshots that only prove the graph rendered SHALL NOT satisfy the interaction acceptance gate.
