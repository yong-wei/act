## MODIFIED Requirements

### Requirement: Domain overview teaching order adopts engineering prerequisites
The domain Teaching Projection builder SHALL ingest every published course-scope `ACT_TEACHING` `PREREQUISITE` whose endpoints are current Authority objects, preserving strength and evidence. An Engineering relation whose presentation family is `post-requisite` MAY still be adopted as REQUIRED when present, but SHALL NOT be required to form the skeleton when the sealed Authority snapshot contains none. Runtime loaders SHALL NOT infer teaching edges from live engineering shards. Course unit order from the syllabus blueprint SHALL be the only allowed source for extension-edge direction.

#### Scenario: Engineering post-requisite exists inside a domain overview
- **WHEN** two DomainConcept overview members are already connected by a published engineering post-requisite
- **THEN** the composed Teaching Projection SHALL contain a matching `PREREQUISITE` teaching edge with engineering provenance
- **AND** the original engineering relation SHALL remain unchanged in its family shard

#### Scenario: Runtime does not infer teaching order
- **WHEN** a domain-default shard is served to the knowledge workspace
- **THEN** visible default teaching edges SHALL come only from published `ACT_TEACHING` relations
- **AND** the workspace SHALL NOT synthesize teaching edges from currently loaded engineering families

#### Scenario: Published course prerequisites are ingested
- **WHEN** the course prerequisite publication contains a published `PREREQUISITE`
- **THEN** the composed domain Teaching Projection SHALL include that edge with the same strength and evidence
- **AND** it SHALL NOT drop the edge merely because it is absent from the engineering snapshot

### Requirement: Domain overview concepts are teaching-connected
Every **course-content-related** DomainConcept in a registered domain's default overview MUST induce a weakly connected graph under published teaching-prerequisite edges. A DomainConcept is course-content-related when it appears in the course Teaching Projection bindings or as a course-prerequisite core/endpoint. Overview members with no teaching-content evidence MUST NOT be force-included. Isolated **related** overview concepts MUST fail the candidate Teaching Projection. Extension teaching edges MAY close gaps along syllabus unit order and MUST NOT use Canonical ID sort as teaching direction. The REQUIRED subset MUST remain acyclic.

#### Scenario: Overview has an isolated concept
- **WHEN** a course-content-related DomainConcept is in the domain-default overview but has no teaching-prerequisite path to the rest of that related subset in the undirected sense
- **THEN** candidate composition SHALL fail closed
- **AND** the prior published Teaching Projection SHALL remain unchanged

#### Scenario: Extension edge closes a gap
- **WHEN** ingested course prerequisites leave two related overview components disconnected
- **THEN** the builder MAY publish a direct teaching-layer edge with extension provenance directed by syllabus unit order
- **AND** it SHALL NOT materialize the transitive closure of existing edges as additional stored facts

#### Scenario: Required cycle is proposed
- **WHEN** a REQUIRED teaching prerequisite would close a directed cycle
- **THEN** publication SHALL fail closed

#### Scenario: Unrelated overview members remain uncovered
- **WHEN** a DomainConcept is in the domain-default overview but is not course-content-related
- **THEN** the composed Teaching Projection MAY omit it from the teaching-order cores
- **AND** that omission SHALL NOT by itself fail composition
