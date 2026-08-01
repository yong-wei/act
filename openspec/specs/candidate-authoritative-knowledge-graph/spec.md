# candidate-authoritative-knowledge-graph Specification

## Purpose
TBD - created by archiving change add-candidate-authoritative-graph. Update Purpose after archive.
## Requirements
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
The candidate graph implementation MUST remain behind a public-activation gate until aggregate V2 graph and candidate-aware Konling acceptance pass on the same ReleaseSet. After that gate opens, all current graph users SHALL be able to view the aggregate candidate by default, and the view MUST identify the exact release, projection version, actual object/relation coverage, core/extension scope, and absence of formal teaching semantics.

#### Scenario: Candidate graph is complete but Konling is not
- **WHEN** aggregate V2 graph APIs and UI are ready but candidate-aware Konling has not passed acceptance on the same ReleaseSet
- **THEN** ordinary users SHALL continue receiving the Legacy graph and the aggregate candidate SHALL remain available only to controlled verification

#### Scenario: Teacher or student opens the graph after activation
- **WHEN** aggregate candidate graph and candidate-aware Konling have both passed acceptance
- **THEN** the graph SHALL default to candidate mode and identify `control-theory-engineering-v0.2`, its 744 nodes, 97 links, current projection digest, and the absence of formal teaching-semantics relations

#### Scenario: User switches to the historical graph
- **WHEN** the user selects the Legacy graph during migration
- **THEN** the independent Legacy API and view SHALL load without combining candidate objects or relations

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

### Requirement: Current aggregate predicates have complete Chinese registrations
The candidate graph MUST register stable Chinese names, directions, line styles, and explanations for all nine predicates in the locked aggregate projection, while retaining the existing raw-value fallback for a valid future predicate not yet present in the display vocabulary.

#### Scenario: Aggregate legend is rendered
- **WHEN** the current aggregate candidate graph displays its predicate legend
- **THEN** `association` SHALL display as “关联”, `applies_to` as “适用于”, `derived_from` as “推导自”, `has_component` as “包含组成部分”, `has_formula` as “具有公式”, `has_representation` as “具有表示”, `is_a` as “属于”, `part_of` as “组成部分”, and `used_to_analyze` as “用于分析”, each with its registered direction and visual contract

#### Scenario: Later valid predicate has no registration
- **WHEN** a separately adapted future release contains a valid predicate absent from the display vocabulary
- **THEN** the UI SHALL display its upstream value and direction rather than hide it or infer a Legacy relation

### Requirement: Candidate governance tiers follow aggregate release membership
The candidate graph MUST derive “核心” and “扩展” only from the locked aggregate release tier and MUST default to showing both tiers.

#### Scenario: Core view is selected
- **WHEN** the user selects “核心”
- **THEN** only aggregate nodes admitted to the Gold tier and their valid visible relations SHALL be shown

#### Scenario: Default view loads
- **WHEN** the aggregate candidate graph opens
- **THEN** both Gold and Silver nodes SHALL be shown, Silver SHALL display as “扩展”, and no tier SHALL be inferred from Legacy data

