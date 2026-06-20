## ADDED Requirements

### Requirement: Automatic-control K/A/Q seed catalog is validated
The system SHALL provide an initial automatic-control seed catalog for K/A/Q objectives and graph nodes.

#### Scenario: Seed catalog is loaded
- **WHEN** the automatic-control seed catalog is loaded
- **THEN** it SHALL include knowledge, capability, and quality graph nodes
- **AND** active nodes SHALL pass the K/A/Q objective and graph schema validation contracts.

### Requirement: Seed knowledge bindings reuse existing runtime nodes
The seed catalog SHALL reuse existing runtime knowledge-node ids where an appropriate node exists.

#### Scenario: Knowledge seed node is bound
- **WHEN** a seed knowledge node represents a concept already present in the runtime knowledge graph
- **THEN** the seed SHALL reference the existing runtime knowledge-node id
- **AND** it SHALL not create a parallel id for the same canonical teaching concept.

### Requirement: Capability and quality seed nodes are evidence-aware
The seed catalog SHALL make capability and quality nodes usable by later diagnosis, path planning, and graph overlays.

#### Scenario: Capability seed node is active
- **WHEN** a capability seed node is active
- **THEN** it SHALL bind to at least one knowledge node and declare observable evidence types.

#### Scenario: Quality seed node is active
- **WHEN** a quality seed node is active
- **THEN** it SHALL declare scenario, observable behaviors, rubric levels, and evidence sources.
