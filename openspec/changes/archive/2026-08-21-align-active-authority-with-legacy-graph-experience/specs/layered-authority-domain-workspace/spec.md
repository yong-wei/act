## ADDED Requirements

### Requirement: Root domain entries fit complete multiline labels
Each active root domain entry SHALL measure its complete human-facing name and summary, wrap them within the available circular width, and use a bounded content-aware radius in deterministic packing. Root entries MUST NOT truncate by fixed character count, allow text to cross another entry, or draw a relation line.

#### Scenario: Root entry has a long Chinese name
- **WHEN** the complete domain name requires multiple lines at the active viewport
- **THEN** the entry SHALL wrap the name within the reviewed line and font bounds and enlarge its collision radius when needed
- **AND** the complete readable name SHALL remain inside the circular entry without overlapping another entry

#### Scenario: Root view resizes
- **WHEN** the viewport changes between supported desktop and mobile sizes
- **THEN** root entries SHALL be repacked deterministically from their final measured radii
- **AND** no connector, membership ray, or decorative line SHALL be introduced

### Requirement: Published teaching relations form visible default edge geometry
When a version-matched domain-default shard declares one or more published teaching relations, the initial domain view SHALL materialize both endpoints and render non-empty visible edge geometry with readable direction. A declared teaching relation MUST NOT disappear because one endpoint was excluded by the initial object budget or because the renderer initialized as an isolated-node grid.

#### Scenario: Domain shard contains teaching relations
- **WHEN** the user enters a domain whose matched default shard contains published direct teaching relations
- **THEN** every admitted default teaching relation SHALL have resolvable visible endpoints and edge geometry within the bounded initial graph
- **AND** teaching direction and layer meaning SHALL be distinguishable without exposing internal enums

#### Scenario: Domain shard contains no teaching relation
- **WHEN** the matched default shard reports empty or unavailable teaching coverage
- **THEN** primary objects SHALL remain selectable and the view SHALL explain the missing teaching layer
- **AND** the workspace SHALL not fabricate edges from engineering relations, names, course order, or layout proximity

### Requirement: Engineering relation filters remain independently available
The domain workspace SHALL retain independent filters for every supported engineering presentation family while the published teaching skeleton is the default layer. Enabling or disabling an engineering family SHALL request only its missing domain shard and SHALL preserve current domain, teaching edges, selected node, inspector, coordinates, pan, and zoom.

#### Scenario: User enables another relation family
- **WHEN** the user enables structure, derivation-and-representation, application-and-analysis, or association
- **THEN** eligible published engineering edges for that family SHALL be added with exact predicate, direction, endpoints, and registered human labels
- **AND** they SHALL not replace or be restated as teaching relations

#### Scenario: User changes several relation filters
- **WHEN** multiple engineering families are enabled or disabled
- **THEN** only eligible edge visibility and missing domain-shard requests SHALL change
- **AND** the graph SHALL retain established node positions and active inspection state
