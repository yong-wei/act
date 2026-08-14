# authority-domain-shard-delivery Specification

## Purpose
Deliver the active Authority knowledge workspace through bounded, version-bound domain shards while keeping optional Teaching Projection failures isolated from Engineering exploration.
## Requirements
### Requirement: Authority domain data is delivered in bounded shard classes
The system SHALL expose separate root, domain-default, relation-family, node-neighborhood and node-detail shard classes. Root shards SHALL contain only reviewed navigation domains and summaries; domain-default shards SHALL contain primary domain objects and available published teaching relations; relation-family and neighborhood shards SHALL load only after explicit user intent; detail shards SHALL contain selected-node text and media references.

#### Scenario: Authority workspace opens
- **WHEN** the active Authority root view is requested
- **THEN** the response SHALL contain the reviewed root catalog and bounded summaries only
- **AND** it SHALL NOT fetch, serialize or parse all Authority objects or relations

#### Scenario: User enters a domain
- **WHEN** a user activates a domain root
- **THEN** the client SHALL request the domain-default shard and only the endpoints needed for available published teaching relations
- **AND** no engineering relation family or detail media SHALL load without corresponding intent

#### Scenario: User requests an engineering family
- **WHEN** the user enables one engineering relation family
- **THEN** the client SHALL request only the missing family shard for the active domain
- **AND** it SHALL reuse already loaded canonical objects and relations

### Requirement: Shards use one composite version envelope
Every learner shard MUST bind the active Authority selection and reviewed domain catalog version and MUST optionally bind the active Teaching Projection version when teaching data is present. The client MUST reject a shard whose required identities do not match its established root envelope.

#### Scenario: Teaching Projection advances independently
- **WHEN** Authority and catalog identities are unchanged but the Teaching Projection version changes
- **THEN** teaching-bearing shard cache entries SHALL invalidate
- **AND** compatible engineering-only shard cache entries MAY remain valid

#### Scenario: Authority identity changes
- **WHEN** the active Authority selection changes
- **THEN** all root, domain, family, neighborhood and detail shards from the prior Authority SHALL be rejected or invalidated

### Requirement: Optional teaching failure does not block engineering shards
The domain shard service SHALL return available engineering objects and requested engineering relations when the optional teaching layer is partial, empty or unavailable. It SHALL return a bounded teaching coverage state and SHALL NOT manufacture teaching edges.

#### Scenario: Domain has no published teaching relation
- **WHEN** Authority and catalog are valid and the domain's teaching layer is empty
- **THEN** primary domain objects SHALL load with empty teaching coverage
- **AND** engineering family and node-neighborhood requests SHALL remain available

### Requirement: Full graph access is not part of normal user loading
Normal `/knowledge` interaction SHALL NOT request a full Authority graph or global remaining shard. Full graph access MUST remain a separately authorized diagnostics path.

#### Scenario: User enables every visible relation filter
- **WHEN** all relation filters are enabled inside one domain
- **THEN** only that domain's eligible shards SHALL load
- **AND** unrelated domains and global remaining relations SHALL not be materialized
