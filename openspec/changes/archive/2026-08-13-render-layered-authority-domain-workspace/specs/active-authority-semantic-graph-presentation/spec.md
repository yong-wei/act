## ADDED Requirements

### Requirement: Current Authority presentation separates navigation, teaching and engineering layers
The current Authority canvas SHALL visibly distinguish presentation-only domain navigation, ACT-owned teaching relations and ActKG engineering relations. Product copy and accessibility descriptions SHALL use human-readable layer meaning and SHALL NOT expose internal layer enums, identifiers or version hashes.

#### Scenario: Domain teaching and engineering edges are both visible
- **WHEN** the user enables an engineering relation family while the default teaching skeleton is visible
- **THEN** visual grammar and the legend SHALL distinguish teaching order from engineering semantics without relying on color alone
- **AND** each edge SHALL retain its source layer and exact published relation meaning

### Requirement: Current Authority default view avoids heterogeneous object overload
The active domain's initial canvas SHALL prioritize DomainConcept and SystemModel objects. Formula and KnowledgeStatement objects SHALL remain available through explicit progressive interactions rather than appearing as an undifferentiated first-load set.

#### Scenario: Dense domain is opened
- **WHEN** a domain contains many Formula and KnowledgeStatement objects
- **THEN** the first domain view SHALL remain bounded and readable
- **AND** search and one-hop exploration SHALL still reach every human-presentable object
