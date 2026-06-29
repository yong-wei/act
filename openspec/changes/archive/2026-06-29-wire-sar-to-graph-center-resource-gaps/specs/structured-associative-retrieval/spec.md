## ADDED Requirements

### Requirement: Graph Center consumes SAR associated evidence
Graph Center SHALL expose SAR-associated evidence for selected graph nodes when scoped association data is available.

#### Scenario: Node detail is opened
- **WHEN** a user opens a Graph Center node detail with SAR enabled
- **THEN** the selected node detail MAY include associated event count, safe top events, trace summary, candidate resource refs, and limitations
- **AND** visibility SHALL match the viewer role and scope.

### Requirement: SAR resource gap suggestions remain draft-only
SAR SHALL provide resource gap candidates without mutating graph bindings or ResourceNode governance state.

#### Scenario: Resource coverage is missing
- **WHEN** a graph node lacks RAG-indexed, citation-ready, assessment, simulation, Arena, path-eligible, or terminal validation coverage
- **THEN** Graph Center MAY request SAR candidate resources or evidence
- **AND** all candidates SHALL be marked suggested or draft until reviewed by the resource governance workflow.
