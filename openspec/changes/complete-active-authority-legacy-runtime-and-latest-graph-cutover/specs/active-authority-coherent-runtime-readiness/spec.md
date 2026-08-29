## ADDED Requirements

### Requirement: The active graph consumer accepts one coherent runtime combination
The `/knowledge` active consumer SHALL derive its production readiness by verifying the existing server-resolved `act-knowledge-surface/v1` response envelope against one final coordinated active receipt whose immutable identities bind the exact Authority capture and snapshot, domain catalog and shards, complete Teaching Projection and composed domain fragments, prerequisite publication, formal resource projection, consumer activation, and active Runtime Release. It MUST reopen and hash-verify every referenced member through the existing source owners and MUST NOT create a second read model, accept a client-selected release, or combine members from different releases, projections, resource envelopes, selector generations, or Runtime views.

#### Scenario: All active members match
- **WHEN** every referenced member reopens with the identities and hashes sealed by the final coordinated active receipt
- **THEN** the consumer SHALL expose the verified common response envelope and its coherent active identity set to the shared graph runtime
- **AND** its readiness evidence SHALL report the exact release, projection, fragment, shard, resource, consumer, and Runtime identities

#### Scenario: One active member is missing or mismatched
- **WHEN** a required member is absent, cannot be reopened, fails its hash, or belongs to another Authority, projection, resource envelope, selector generation, or Runtime view
- **THEN** active product readiness SHALL fail closed before the combination is reported as a successful cutover
- **AND** the consumer SHALL NOT fill the gap from legacy data, database relations, engineering edges, or a stale local pointer

### Requirement: The latest qualified product combination includes complete Teaching relations
The execution-time latest product cutover SHALL require a complete matching Teaching Projection with composed domain fragments and zero unresolved governance decisions. Every representative active domain with admitted Teaching relations SHALL expose its exact published ACT_TEACHING edges by default. A partial, empty, unavailable, or stale projection MAY remain a truthful non-success state but MUST NOT qualify the latest product combination.

#### Scenario: Qualified latest combination is displayed
- **WHEN** the provider has committed a final coordinated active receipt for the captured latest compatible release and its complete Teaching artifacts revalidate
- **THEN** the active graph SHALL display the matching published containment, prerequisite, and pedagogical-association relations
- **AND** it SHALL NOT show “教学关系暂不可用” for domains whose qualified fragments contain those relations

#### Scenario: General projection exists without composed fragments
- **WHEN** a general Teaching Projection pointer exists but the composed domain-fragment selector or immutable fragment set is absent or mismatched
- **THEN** the active consumer SHALL reject latest-cutover readiness
- **AND** it SHALL NOT treat the general pointer, database seed, or projection counts as proof that the product Teaching layer is active

### Requirement: Consumer readiness does not own production mutation
The active graph consumer SHALL read the latest coherent combination only after the existing coordinated cutover authority has qualified and, under separate authorization, activated it. This capability MUST NOT capture ActKG releases, generate formal resources or Teaching artifacts, publish Runtime Releases, write selectors, advance Runtime lifecycle state, create transaction receipts, or perform compensation. Product acceptance SHALL remain pending until the provider's final active receipt exists and consumer verification passes.

#### Scenario: Qualified candidate is not active
- **WHEN** the provider has produced a newer non-selectable candidate without a final coordinated active receipt
- **THEN** the active consumer SHALL continue to use the exact current predecessor combination
- **AND** candidate recency SHALL NOT authorize a selector write or latest-cutover success

#### Scenario: Provider activates the successor
- **WHEN** the existing provider completes its authorized stopped-service transaction and the final active receipt reopens exactly
- **THEN** the consumer SHALL re-resolve the coherent successor and run product acceptance against it
- **AND** this read path SHALL perform no additional selector mutation

### Requirement: The shared runtime remains compatible with coordinated rollback
The active adapter and shared Force Graph runtime SHALL consume both the sealed predecessor and the qualified successor through the same coherent-envelope contract. If the cutover provider restores the predecessor, the consumer SHALL restore predecessor data and namespace-scoped presentation state without falling back to legacy graph data or claiming latest-cutover success.

#### Scenario: Successor verification triggers rollback
- **WHEN** provider or consumer verification fails and the provider restores the exact predecessor combination
- **THEN** `/knowledge` SHALL render that coherent predecessor through the shared Force Graph runtime after service recovery
- **AND** readiness SHALL identify the predecessor and the failed successor attempt truthfully

#### Scenario: Rollback state is unknown
- **WHEN** the active identities match neither the sealed predecessor nor the expected successor
- **THEN** the consumer SHALL fail closed instead of selecting a mixed or legacy combination
- **AND** product acceptance SHALL remain incomplete pending explicit recovery
