## ADDED Requirements

### Requirement: Knowledge graph uses the shared floating dock
The knowledge graph workspace SHALL expose Konling and related shell-level floating controls through the shared platform dock.

#### Scenario: Konling is available on `/knowledge`
- **WHEN** Konling is enabled on the knowledge graph route
- **THEN** the assistant SHALL render through the shared right-bottom dock model
- **AND** page-local duplicate assistant regions or separate right-bottom fixed systems SHALL NOT render concurrently.

#### Scenario: Konling expands in the knowledge workspace
- **WHEN** the user expands Konling while directory tools, relation filters, legend, graph controls, or selected-node inspector are visible
- **THEN** the assistant SHALL remain keyboard reachable and readable
- **AND** it SHALL NOT obscure required graph controls, inspector actions, or primary graph interaction.
