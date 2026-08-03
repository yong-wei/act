## MODIFIED Requirements

### Requirement: Konling graph context is server-owned
Graph context MUST resolve Authority, Teaching Projection, course scope, current Canonical IDs, linked resources, prerequisite neighborhood, and optional card through a server-owned contract. The client MAY provide a hint but MUST NOT provide authoritative teaching data.

#### Scenario: Signed context is valid
- **WHEN** a graph-aware request carries a valid scoped context token
- **THEN** the server SHALL re-resolve the listed IDs and include matching Authority/Projection identities
- **AND** it SHALL reject mismatched or out-of-scope IDs before tool execution

#### Scenario: Teaching layer is absent
- **WHEN** the Authority is valid but no teaching projection is available
- **THEN** the context SHALL expose that status
- **AND** engineering graph context MAY continue without synthesized teaching edges

### Requirement: Graph-aware answers expose grounding
Graph-aware answers MUST identify whether a claim came from Engineering Authority, Teaching Resource Projection, prerequisite data, or an optional card and MUST preserve citation-safe source identities.

#### Scenario: Claim uses a teaching prerequisite
- **WHEN** a response explains why a course resource is recommended
- **THEN** it SHALL cite the ACT prerequisite/resource evidence and projection identity
- **AND** it SHALL not represent the relation as an ActKG engineering predicate
