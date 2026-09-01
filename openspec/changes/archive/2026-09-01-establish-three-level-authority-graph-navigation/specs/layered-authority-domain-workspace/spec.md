## ADDED Requirements

### Requirement: Navigation levels are backed by distinct bounded server responses
Root, domain overview and selected semantic neighborhood SHALL each use a distinct version-matched bounded response. Client filtering of a previously fetched complete domain MUST NOT satisfy a navigation level.

#### Scenario: Product QA inspects domain traffic
- **WHEN** QA enters a domain and then selects one concept
- **THEN** the request sequence SHALL contain a bounded domain overview followed by a bounded one-hop request
- **AND** no ordinary request SHALL return the complete domain object set

#### Scenario: Search locates an undisclosed object
- **WHEN** search resolves an eligible object outside the current overview
- **THEN** selection SHALL load only its owning-domain context and bounded one-hop network
- **AND** search SHALL not promote every matching type into the domain overview
