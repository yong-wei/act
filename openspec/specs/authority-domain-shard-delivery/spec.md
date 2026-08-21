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

### Requirement: Node-detail shards include governed related content and launch descriptors
An active Authority node-detail shard SHALL project the selected semantic object, published one-hop neighbors, eligible Knowledge Card and infograph references, and role-authorized registered resource bindings in one bounded response. Every optional content block and binding MUST be resolved by stable identity against the shard envelope and MUST NOT be inferred from display text.

#### Scenario: Selected node has registered resources
- **WHEN** a role-authorized selected node has one or more governed course, handout, step, textbook, simulation, Arena, or feature-owned resource bindings
- **THEN** the detail shard SHALL return their human-facing title, typed binding role, resource kind, availability, and source-owned launch descriptor
- **AND** it SHALL not expose an internal filesystem path, registry implementation path, raw canonical ID, or guessed route

#### Scenario: Optional content identity drifts
- **WHEN** a Knowledge Card, infograph, or resource-binding manifest does not match the selected Authority and applicable teaching/resource projection identity
- **THEN** the mismatched optional block SHALL be omitted with a bounded availability state
- **AND** the base semantic detail and valid published relation summaries SHALL remain available

### Requirement: Detail launch descriptors preserve source ownership and authorization
Every returned resource launch descriptor SHALL identify an existing route, registry entry, or feature-owned launcher class without embedding the owned feature's business payload. The server SHALL apply current-role visibility before projection, and the client SHALL pass the descriptor to the existing launcher instead of constructing a target from the Authority node identity.

#### Scenario: Learner launches a mapped resource
- **WHEN** the learner activates a resource action from the active Authority inspector
- **THEN** the target SHALL resolve through the existing source-owned authorization and launch contract
- **AND** the knowledge workspace SHALL retain a return path without absorbing the launched feature's business logic

#### Scenario: Binding exists but role cannot access it
- **WHEN** the selected node has a governed binding outside the current role's visibility or availability
- **THEN** the public detail shard SHALL omit the unsafe descriptor or return a bounded unavailable action permitted for that role
- **AND** it SHALL not disclose the hidden target or policy reason

### Requirement: Detail shards distinguish mathematical content from prose
Trusted Formula expressions and governed knowledge-content math nodes SHALL be projected as explicit mathematical fields suitable for the LaTeX renderer. Ordinary names, explanations, resource titles, and relation sentences MUST remain text fields and MUST NOT be promoted to mathematical content by client-side guessing.

#### Scenario: Formula detail is projected
- **WHEN** the selected object has trusted Formula content
- **THEN** the detail shard SHALL distinguish the reviewed mathematical expression from localized explanatory prose
- **AND** both fields SHALL remain bound to the same selected object and shard envelope

