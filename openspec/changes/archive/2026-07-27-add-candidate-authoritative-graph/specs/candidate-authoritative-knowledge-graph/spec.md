## ADDED Requirements

### Requirement: Candidate graph uses independent versioned APIs
The system SHALL expose the candidate canvas and node detail through V2 contracts that do not merge, transform, or fill from the legacy graph API.

#### Scenario: User switches graph versions
- **WHEN** an authorized user selects the candidate or legacy graph
- **THEN** the client SHALL call the corresponding independent API and replace the view without combining responses

#### Scenario: Candidate lookup is empty
- **WHEN** a candidate object or relation is unavailable
- **THEN** the UI SHALL show the candidate absence and MUST NOT query legacy data automatically

### Requirement: All formal authoritative object types are first-class
The candidate canvas MUST render every current-Schema-valid formal object as a typed first-class node and provide an extensible display vocabulary.

#### Scenario: Known canonical type is rendered
- **WHEN** an object is a DomainConcept, Formula, KnowledgeStatement, or SystemModel
- **THEN** the UI SHALL use its registered Chinese type label, typed visual treatment, and detail template

#### Scenario: Unregistered valid type is rendered
- **WHEN** a current-Schema-valid canonical type has no display adapter
- **THEN** the UI SHALL show the upstream type name with a generic read-only treatment rather than hiding it

### Requirement: Navigation preserves cross-type engineering relations
The top-level candidate graph navigation MUST classify by `canonical_type` and retain directly connected heterogeneous objects.

#### Scenario: User opens a type category
- **WHEN** the user selects one canonical type
- **THEN** the graph SHALL center that type and include one-hop related heterogeneous nodes with weaker visual emphasis

### Requirement: Predicate and governance semantics remain exact
The candidate graph MUST display exact ActKG predicates, direction, and governance level without mapping them to legacy relation classes.

#### Scenario: Core view is selected
- **WHEN** the user selects “核心”
- **THEN** the graph SHALL show Gold relations only

#### Scenario: Default extension view loads
- **WHEN** the candidate graph first opens
- **THEN** the graph SHALL show Gold and Silver relations, label Silver as “扩展”, and visually distinguish them

#### Scenario: Predicate is not in the display vocabulary
- **WHEN** a current-Schema-valid predicate has no Chinese registration
- **THEN** the UI SHALL display its upstream value and direction rather than infer a meaning

### Requirement: Candidate coverage is explicit
The candidate graph implementation MUST remain behind a public-activation gate until candidate-aware Konling has passed its read-only acceptance; after that gate opens, all current graph users SHALL be able to view the first candidate ReleaseSet and the default candidate view MUST identify it as a partial root-locus release with unpublished teaching semantics.

#### Scenario: Candidate graph is complete but Konling is not
- **WHEN** V2 graph APIs and UI are ready but candidate-aware Konling has not passed acceptance
- **THEN** ordinary users SHALL continue receiving the Legacy graph and the candidate SHALL remain available only to controlled verification

#### Scenario: Teacher or student opens the graph after activation
- **WHEN** the first candidate ReleaseSet and candidate-aware Konling have both passed acceptance
- **THEN** the graph SHALL default to candidate mode and display the Release identity, actual coverage, and teaching-semantics limitation

### Requirement: Current root-locus predicates have complete Chinese registrations
The candidate graph MUST register stable Chinese name, direction, line style, and explanation for all six predicates in the first Release.

#### Scenario: First Release legend is rendered
- **WHEN** the root-locus candidate graph displays its predicate legend
- **THEN** `association` SHALL display as “关联”, `represented_by` as “表示为”, `applies_to` as “适用于”, `derived_from` as “推导自”, `used_to_analyze` as “用于分析”, and `is_a` as “属于”, each with its registered direction and visual contract

### Requirement: Node detail is role layered
Candidate node detail MUST derive from one authoritative object while exposing different governance depth by role.

#### Scenario: Student opens detail
- **WHEN** a student opens a candidate object
- **THEN** the detail SHALL show readable content, type, relations, and accessible sources without migration diagnostics

#### Scenario: Teacher opens detail
- **WHEN** a teacher opens the same object
- **THEN** the detail SHALL additionally show Release, core or extension status, review state, and source coverage

#### Scenario: Administrator opens migration detail
- **WHEN** an administrator opens the same object
- **THEN** the detail MAY additionally show hashes, ingest diagnostics, hidden fields, and rebinding status
