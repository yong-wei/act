# domain-teaching-order-coverage Specification

## Purpose
领域默认概览的教学顺序覆盖门禁：构建期把工程 `post-requisite` 族采纳为 `ACT_TEACHING` `PREREQUISITE` 骨架，用教学扩展边把每个注册领域的 DomainConcept 概览弱连通，孤立概念或 REQUIRED 环则 fail closed。运行时不得从 live 工程分片推断教学边。
## Requirements
### Requirement: Domain overview teaching order adopts engineering prerequisites
The domain Teaching Projection builder SHALL publish an `ACT_TEACHING` `PREREQUISITE` edge for every Engineering relation whose presentation family is `post-requisite` and whose endpoints are current Authority objects. Each adopted edge SHALL keep the engineering relation identity as provenance and SHALL NOT rewrite Engineering Authority bytes. Runtime loaders SHALL NOT infer teaching edges from live engineering shards.

#### Scenario: Engineering post-requisite exists inside a domain overview
- **WHEN** two DomainConcept overview members are already connected by a published engineering post-requisite
- **THEN** the composed Teaching Projection SHALL contain a matching `PREREQUISITE` teaching edge with engineering provenance
- **AND** the original engineering relation SHALL remain unchanged in its family shard

#### Scenario: Runtime does not infer teaching order
- **WHEN** a domain-default shard is served to the knowledge workspace
- **THEN** visible default teaching edges SHALL come only from published `ACT_TEACHING` relations
- **AND** the workspace SHALL NOT synthesize teaching edges from currently loaded engineering families

### Requirement: Domain overview concepts are teaching-connected
Every registered domain's default DomainConcept overview MUST induce a weakly connected graph under published teaching-prerequisite edges. Isolated overview concepts MUST fail the candidate Teaching Projection. Extension teaching edges MAY be added to close gaps provided they do not reverse an adopted engineering prerequisite and do not store transitive closure as a new fact. The REQUIRED subset MUST remain acyclic.

#### Scenario: Overview has an isolated concept
- **WHEN** a DomainConcept is in the domain-default overview but has no teaching-prerequisite path to the rest of that overview in the undirected sense
- **THEN** candidate composition SHALL fail closed
- **AND** the prior published Teaching Projection SHALL remain unchanged

#### Scenario: Extension edge closes a gap
- **WHEN** adopted engineering prerequisites leave two overview components disconnected
- **THEN** the builder MAY publish a direct teaching-layer edge with extension provenance that does not reverse any REQUIRED engineering-backed edge
- **AND** it SHALL NOT materialize the transitive closure of existing edges as additional stored facts

#### Scenario: Required cycle is proposed
- **WHEN** a REQUIRED teaching prerequisite would close a directed cycle
- **THEN** publication SHALL fail closed

