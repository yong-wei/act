## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Current root-locus predicates have complete Chinese registrations
**Reason**: The current candidate is no longer the six-predicate partial root-locus release.

**Migration**: Register the complete predicate vocabulary of `control-theory-engineering-v0.2` under `Current aggregate predicates have complete Chinese registrations`.

## ADDED Requirements

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
