## ADDED Requirements

### Requirement: Active root and domain shards have complete catalog coverage
The Authority shard set SHALL derive its visible-domain denominator from the exact active reviewed catalog and SHALL seal one valid domain-default shard for every visible root domain. A root entry MUST NOT be published when its default, search, neighborhood, or detail closure is absent or identity-mismatched.

#### Scenario: Fifteen-domain catalog is materialized
- **WHEN** the active catalog contains fifteen visible domains
- **THEN** the candidate shard set SHALL contain fifteen matching default shards and complete follow-on closure
- **AND** every root entry SHALL resolve to one of those exact sealed shards

#### Scenario: One domain default is missing
- **WHEN** any catalog domain lacks a matching default shard
- **THEN** shard-set qualification SHALL fail before publication
- **AND** the product SHALL NOT expose a clickable unavailable or failing root entry

### Requirement: Domain-default shards contain only bounded domain concepts
Each active domain-default response SHALL contain only qualified `DomainConcept` objects within explicit object-count and byte budgets. Formula, KnowledgeStatement, SystemModel, ModelRepresentation and future secondary types MUST be obtained through bounded search or published one-hop responses.

#### Scenario: Dense domain is opened
- **WHEN** a domain contains concepts and hundreds of secondary objects
- **THEN** its default response SHALL materialize only the bounded DomainConcept overview
- **AND** the browser SHALL NOT receive or retain the complete heterogeneous domain

#### Scenario: Secondary object is requested
- **WHEN** a viewer selects a search hit or follows a published concept relation
- **THEN** the server SHALL return a bounded matching neighborhood containing the eligible secondary object
- **AND** no client-side full-domain cache SHALL be required
