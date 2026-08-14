## ADDED Requirements

### Requirement: Authority workspace uses domain and knowledge levels
The active Authority workspace SHALL render a first level containing the eight reviewed domain roots and the separate aggregate entry. Activating a domain SHALL render a second-level graph of real Authority objects scoped to that domain; it SHALL NOT render presentation membership as an engineering or teaching relation.

#### Scenario: User opens the root level
- **WHEN** a product user opens current Authority
- **THEN** the canvas SHALL show readable domain navigation and summaries without member rays or global relation density
- **AND** Formula and KnowledgeStatement objects SHALL not populate the root level

#### Scenario: User enters a domain
- **WHEN** a domain root is activated
- **THEN** the workspace SHALL replace root navigation with the domain's bounded object-and-relation view
- **AND** it SHALL preserve a visible return path to the domain level

### Requirement: Published teaching order is the default domain relation layer
A domain's initial relation view SHALL show published direct ACT_TEACHING prerequisites and post-requisites by default. Teaching coverage that is partial, empty or unavailable SHALL be disclosed honestly and SHALL NOT block primary Authority object selection or engineering relation filters.

#### Scenario: Domain has published teaching edges
- **WHEN** a version-matched Teaching Projection contains direct relations for the active domain
- **THEN** those relations SHALL form the default learning-order skeleton with readable direction
- **AND** unrelated engineering families SHALL remain off until requested

#### Scenario: Domain has no published teaching edge
- **WHEN** the domain teaching coverage is empty or partial
- **THEN** primary Authority objects SHALL remain visible and selectable
- **AND** the workspace SHALL not infer order from engineering relations, object names or layout

### Requirement: Engineering relations use explicit presentation filters
The workspace SHALL provide separate filters for structure, derivation-and-representation, application-and-analysis, and association while preserving every relation's exact published predicate, endpoints and direction in detail. Enabling a filter SHALL load only the active domain's missing shard.

#### Scenario: User enables derivation and representation
- **WHEN** the user enables the derivation-and-representation filter
- **THEN** eligible published `derived_from`, `has_formula` and `has_representation` relations SHALL appear with registered human labels
- **AND** none SHALL be restated as a teaching prerequisite

#### Scenario: User enables association
- **WHEN** the user enables association with no selected node
- **THEN** association edges SHALL remain bounded by the domain presentation budget
- **AND** selection SHALL reveal only a bounded published one-hop neighborhood

### Requirement: Secondary object types are disclosed on demand
DomainConcept and SystemModel SHALL form the default object layer. Formula and KnowledgeStatement SHALL load through explicit filters, search, directory selection or bounded one-hop expansion and SHALL remain reachable without filling the initial domain canvas.

#### Scenario: User searches for a formula
- **WHEN** search resolves a presentable Formula outside the current visible objects
- **THEN** the workspace SHALL load its matching domain context and select it
- **AND** the formula identifier or raw type SHALL not be used as fallback text

### Requirement: Cross-domain relations use explicit boundary navigation
A relation whose adjacent object belongs outside the active domain SHALL be represented by a human-readable boundary cue until the user explicitly follows it. Following the cue SHALL enter a reviewed target domain before selecting the adjacent object.

#### Scenario: User follows a cross-domain neighbor
- **WHEN** an eligible published relation reaches an object outside the active domain
- **THEN** the workspace SHALL show the target domain name and relation meaning without loading that domain's full content
- **AND** explicit activation SHALL load the target domain and then focus the real adjacent object
