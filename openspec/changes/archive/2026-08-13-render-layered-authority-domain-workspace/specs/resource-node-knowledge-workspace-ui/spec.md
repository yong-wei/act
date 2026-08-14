## ADDED Requirements

### Requirement: Authority relation controls use five human semantic groups
The knowledge workspace SHALL present teaching order as the default group and SHALL offer structure, derivation-and-representation, application-and-analysis, and association as independently selectable groups. The controls SHALL preserve active domain, selection, cached shards, layout and inspector state.

#### Scenario: User changes relation groups
- **WHEN** one or more relation groups are enabled or disabled
- **THEN** only eligible published edges in the active domain SHALL change visibility
- **AND** the workspace SHALL not request the global graph, reset positions or replace exact predicates in the inspector

### Requirement: Layered workspace remains usable with incomplete teaching projection
The workspace SHALL keep domain objects, engineering filters, search, directory and node inspection available when teaching coverage is partial, empty or unavailable.

#### Scenario: Teaching layer becomes unavailable after domain entry
- **WHEN** the optional teaching shard fails while Authority and catalog shards remain valid
- **THEN** the workspace SHALL remove or mark only the teaching layer
- **AND** current engineering objects, selection and loaded engineering relations SHALL remain usable
