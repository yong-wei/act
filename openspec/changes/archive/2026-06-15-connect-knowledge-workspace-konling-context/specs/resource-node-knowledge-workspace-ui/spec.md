## ADDED Requirements

### Requirement: Knowledge workspace publishes selected context to the shared assistant
The knowledge workspace SHALL publish stable selected-node and graph-state context for the shared Konling assistant without coupling hover preview or local UI internals to assistant permissions.

#### Scenario: Selected node changes
- **WHEN** the user selects a different graph node
- **THEN** the knowledge workspace SHALL update the assistant context with the selected node and current explicit graph state
- **AND** the update SHALL not rebuild graph layout or remount the shared assistant.

#### Scenario: User only hovers a node
- **WHEN** the user hovers over a graph node without selecting it
- **THEN** hover preview MAY show local UI information
- **AND** hover SHALL NOT become durable Konling context unless the user explicitly selects or focuses that node.
