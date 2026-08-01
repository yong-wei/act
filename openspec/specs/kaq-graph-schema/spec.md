# kaq-graph-schema Specification

## Purpose
Define domain-typed K/A/Q graph body schemas and validation rules while keeping learner, class, and resource overlays outside canonical graph records.
## Requirements
### Requirement: K/A/Q graph body data is domain-typed
The system SHALL define separate but compatible graph body schemas for knowledge, capability, and quality graph domains with relation metadata usable by goal expansion.

#### Scenario: Graph catalog is validated
- **WHEN** a K/A/Q graph catalog is loaded
- **THEN** every node SHALL declare a stable id, domain, objective binding, portrait dimension mapping, and active or inactive status
- **AND** every edge SHALL declare a stable id, source node id, target node id, domain, relation, strength, and rationale
- **AND** validation SHALL reject unknown node references, domain mismatches, unknown objectives, objective-domain mismatches, invalid portrait dimensions, invalid relations, invalid strengths, and missing edge rationale.

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

### Requirement: KAQ knowledge identity resolves through Canonical bindings
The KAQ schema SHALL represent knowledge roles independently from Canonical Objects and SHALL resolve them through explicit versioned binding entities.

#### Scenario: KAQ role has multiple valid engineering objects
- **WHEN** one teaching role legitimately spans more than one Canonical Object
- **THEN** the schema SHALL preserve explicit role-qualified bindings rather than merging the objects

### Requirement: KAQ and ActKG relation ownership is typed
The schema MUST distinguish KAQ-owned knowledge-capability-quality relations from ActKG-owned knowledge-to-knowledge Teaching Projection relations.

#### Scenario: Consumer requests path relations
- **WHEN** both relation namespaces are available
- **THEN** the schema SHALL expose authority and version so the consumer cannot treat them as one untyped edge set
