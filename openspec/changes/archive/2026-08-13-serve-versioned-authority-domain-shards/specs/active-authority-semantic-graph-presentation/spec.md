## ADDED Requirements

### Requirement: Active Authority progressive exploration is server-bounded
The current Authority workspace SHALL obtain root, active-domain, requested relation-family, selected one-hop and selected-detail data from bounded server responses. Client-side truncation of a previously fetched full graph SHALL NOT satisfy the progressive-loading requirement.

#### Scenario: First active Authority response is measured
- **WHEN** product QA opens the active Authority workspace with a cold client cache
- **THEN** no ordinary product request SHALL return or parse the complete Authority object and relation sets
- **AND** reviewed root navigation SHALL become usable before any domain member shard is required

#### Scenario: User expands one node
- **WHEN** a selected object requests a one-hop neighborhood
- **THEN** the server SHALL return a deterministic bounded neighborhood using only published relations
- **AND** expansion SHALL not require all graph objects to remain in browser memory
