## MODIFIED Requirements

### Requirement: Candidate coverage is explicit
The candidate graph implementation MUST remain a fixed, independently identified diagnostic view. It MUST NOT become the ordinary current graph solely because its aggregate V2 APIs are complete or a public candidate flag is set; the ordinary current graph SHALL instead be resolved by the active Authority workspace from the committed activation selector.

#### Scenario: Candidate graph is complete but active Authority is unavailable
- **WHEN** aggregate V2 candidate APIs are available but the active Authority selector or identity validation is unavailable
- **THEN** ordinary users SHALL receive the explicit active-unavailable or historical Legacy experience according to their selected mode
- **AND** the aggregate candidate SHALL remain available only to controlled administrator verification

#### Scenario: Teacher or student opens the graph after active Authority activation
- **WHEN** the committed active Authority workspace validates for a teacher or student
- **THEN** the graph SHALL default to active Authority mode and identify its resolved activation identity
- **AND** it SHALL not fetch or describe `control-theory-engineering-v0.2` as the current graph

#### Scenario: Administrator chooses the candidate diagnostic
- **WHEN** an administrator with controlled verification selects the aggregate candidate
- **THEN** the client SHALL identify `control-theory-engineering-v0.2`, its actual object/relation coverage, projection version and absence of formal teaching semantics
- **AND** it SHALL keep that response independent from active Authority and Legacy graph data

#### Scenario: User switches to the historical graph
- **WHEN** a user selects the Legacy graph during migration
- **THEN** the independent Legacy API and view SHALL load without combining candidate or active Authority objects or relations
