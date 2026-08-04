## MODIFIED Requirements

### Requirement: ActKG graph projection loads as a gated graph source
The graph projection MUST expose Engineering Authority as one layer and MUST NOT treat ACT teaching/resource coverage as a prerequisite for loading it. ACT teaching prerequisites and resource bindings MAY be attached as separately gated layers with their own projection/scope identity.

#### Scenario: Authority is active and Teaching Projection is absent
- **WHEN** a graph request targets Engineering Authority and no teaching projection exists
- **THEN** engineering nodes and exact engineering relations SHALL load
- **AND** teaching/resource layers SHALL report absent or `NOT_PROJECTED` without blocking the graph

#### Scenario: Teaching layer is requested
- **WHEN** a caller requests a valid course scope and Teaching Projection combination
- **THEN** the payload SHALL include only scoped ACT prerequisite/resource records
- **AND** it SHALL not rewrite or union them into ActKG engineering relations

### Requirement: Projection version binds to graph version identity
Every graph response MUST identify the Authority release and, when present, Teaching Projection ID/scope and resource/prerequisite layer versions. Consumers MUST NOT silently combine records from different identities.

#### Scenario: One layer drifts
- **WHEN** the requested Authority or Projection identity/hash does not match its manifest
- **THEN** that layer SHALL fail closed
- **AND** the response SHALL retain unaffected valid layers with explicit status

### Requirement: Candidate authoritative projection is isolated from Legacy production
Course and classroom consumers MAY read a named candidate/pinned combination for shadow or compatibility, but formal selectors MUST resolve either one validated combination or an explicit Legacy fallback.

#### Scenario: Projection candidate is unavailable
- **WHEN** a course scope requests a missing candidate projection
- **THEN** the resolver SHALL return explicit unavailable/fallback status
- **AND** it SHALL not mix candidate resources with Legacy prerequisite or card data
