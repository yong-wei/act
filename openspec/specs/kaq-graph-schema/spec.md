# kaq-graph-schema Specification

## Purpose
Define domain-typed K/A/Q graph body schemas and validation rules while keeping learner, class, and resource overlays outside canonical graph records.
## Requirements
### Requirement: K/A/Q graph body data is domain-typed
The system SHALL define separate but compatible graph body schemas for knowledge, capability, and quality graph domains with relation metadata usable by goal expansion.

#### Scenario: Graph relation supports expansion
- **WHEN** a graph edge is used by goal subgraph expansion
- **THEN** the edge SHALL expose relation, strength, rationale, and enough metadata to map it to prerequisite, remediation, extension, transfer, or evidence semantics
- **AND** missing semantics SHALL be represented as a limitation in expansion output rather than silently assumed.

### Requirement: Capability and quality graphs carry observable teaching semantics
Capability and quality graph nodes SHALL declare the evidence semantics needed for diagnosis, planning, and teacher review.

#### Scenario: Capability node is defined
- **WHEN** a capability graph node is active
- **THEN** it SHALL bind to at least one knowledge node
- **AND** it SHALL declare Bloom-style level, behavior verb, task context, success criteria, observable evidence types, and evaluation methods.

#### Scenario: Quality node is defined
- **WHEN** a quality graph node is active
- **THEN** it SHALL declare scenario, observable behaviors, rubric levels, and evidence sources
- **AND** it SHALL not be accepted as a slogan-only node without observable evidence semantics.

### Requirement: Graph overlays are separated from graph body data
The system SHALL keep learner state, class heat, and resource coverage overlays outside graph body node definitions.

#### Scenario: Overlay payload is generated
- **WHEN** a graph overlay is generated for a learner, class, or resource coverage mode
- **THEN** it SHALL reference graph node ids and graph domain
- **AND** it SHALL not mutate objective or graph catalog records.

