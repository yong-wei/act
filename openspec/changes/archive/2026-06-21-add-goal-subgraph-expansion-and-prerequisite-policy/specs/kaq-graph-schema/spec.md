## MODIFIED Requirements

### Requirement: K/A/Q graph body data is domain-typed
The system SHALL define separate but compatible graph body schemas for knowledge, capability, and quality graph domains with relation metadata usable by goal expansion.

#### Scenario: Graph relation supports expansion
- **WHEN** a graph edge is used by goal subgraph expansion
- **THEN** the edge SHALL expose relation, strength, rationale, and enough metadata to map it to prerequisite, remediation, extension, transfer, or evidence semantics
- **AND** missing semantics SHALL be represented as a limitation in expansion output rather than silently assumed.
