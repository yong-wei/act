## ADDED Requirements

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
