## ADDED Requirements

### Requirement: Authority domain roots use reviewed many-to-many membership
The knowledge workspace SHALL consume the reviewed Authority domain display catalog as its root navigation source. It SHALL use the catalog's many-to-many membership and preferred navigation domain instead of inferring domain ownership from arbitrary incident relations, names or layout proximity.

#### Scenario: Multi-domain object is opened from search
- **WHEN** search resolves an Authority object with several reviewed memberships
- **THEN** the navigation resolver SHALL enter its deterministic preferred domain and select the same canonical object
- **AND** the inspector SHALL make the other human-readable domain memberships available

#### Scenario: Catalog is unavailable
- **WHEN** the active Authority has no valid matching display catalog
- **THEN** the new domain workspace SHALL report a controlled navigation-unavailable state
- **AND** it SHALL NOT synthesize roots from object names or engineering relations
