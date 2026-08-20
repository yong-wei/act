## ADDED Requirements

### Requirement: Root domain entries are line-free circular navigation projections
The root view's circular domain entries SHALL be presentation-only navigation projections arranged by deterministic spatial packing. The root view SHALL NOT draw connecting lines, edges, rays or decorative links of any kind between root entries or between an entry and the aggregate entry, and root entries SHALL NOT be presented as ActKG knowledge objects. If published inter-domain Authority or teaching relations become available in an active release, rendering them at the root SHALL require a separately approved proposal and SHALL NOT occur by default.

#### Scenario: Root entries render
- **WHEN** the root view renders its circular domain entries and the aggregate entry
- **THEN** no line, edge, ray or connector geometry SHALL be drawn between any two entries
- **AND** the spatial arrangement SHALL NOT be presented as a navigation hierarchy or semantic relation

#### Scenario: Active release contains published inter-domain relations
- **WHEN** the active composite release contains published relations whose endpoints belong to different domains
- **THEN** the root view SHALL still render no lines between entries
- **AND** those relations SHALL remain reachable only through domain-level views and explicit cross-domain boundary navigation

#### Scenario: A circular entry lacks a human-facing label
- **WHEN** a catalog domain has no non-empty human-facing display name or summary
- **THEN** the entry SHALL fail closed with a controlled unavailable state
- **AND** it SHALL NOT substitute an internal identifier, release identity, enum or path

## MODIFIED Requirements

### Requirement: Authority workspace uses domain and knowledge levels
The active Authority workspace SHALL render a first level containing one circular domain entry per domain in the ACTIVE composite release's domain catalog plus one separate circular aggregate entry, replacing the previous card grid. The number of domain entries SHALL be derived from the active composite release's domain catalog at read time and SHALL NOT be hard-coded. Activating a domain SHALL render a second-level graph of real Authority objects scoped to that domain by progressively loading only that domain's root shard and default published teaching relations; it SHALL NOT render presentation membership as an engineering or teaching relation.

#### Scenario: User opens the root level
- **WHEN** a product user opens current Authority
- **THEN** the canvas SHALL show one circular entry per catalog domain with its human-facing name and short summary, plus the aggregate entry, without member rays or global relation density
- **AND** Formula and KnowledgeStatement objects SHALL not populate the root level

#### Scenario: Domain catalog changes across activations
- **WHEN** a composite release whose domain catalog has a different domain count becomes active
- **THEN** the root level SHALL render exactly the new catalog's domain entries without a code change
- **AND** it SHALL NOT show entries from any inactive release's catalog

#### Scenario: User enters a domain
- **WHEN** a circular domain entry is activated
- **THEN** the workspace SHALL load only that domain's root shard and default published teaching relations and replace root navigation with the domain's bounded object-and-relation view
- **AND** it SHALL preserve a visible return path to the domain level
- **AND** it SHALL NOT fetch the complete global object or relation sets
