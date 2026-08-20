## MODIFIED Requirements

### Requirement: Authority navigation uses a reviewed domain catalog
The system SHALL publish a versioned display catalog whose registered top-level engineering domains are exactly the domain entries declared by the domain catalog data of the bound composite release envelope. The domain vocabulary SHALL remain a flat controlled top-level list with no sub-domain hierarchy, and the number of domain entries SHALL derive from that catalog data and SHALL NOT be hard-coded in code, configuration defaults, or specification text. The control-theory integration component SHALL be a separately typed aggregate navigation entry and SHALL NOT be counted as a peer domain.

#### Scenario: Root catalog is published
- **WHEN** the display catalog passes review and validation against one bound Authority selection
- **THEN** the root projection SHALL expose exactly the release-declared domains in reviewed order plus one separately typed aggregate entry
- **AND** none of those presentation entries SHALL be represented as an Authority object or relation

#### Scenario: Catalog invents an unregistered domain
- **WHEN** a catalog version contains an unregistered peer domain or promotes the aggregate entry to a peer domain
- **THEN** publication SHALL fail closed

#### Scenario: Catalog drifts from the release domain data
- **WHEN** a catalog version contains a domain absent from the bound release's domain catalog data, omits a declared domain, asserts a hard-coded expected domain count, or promotes the aggregate entry to a peer domain
- **THEN** publication SHALL fail closed

### Requirement: Domain membership is reviewed and many-to-many
Each catalog member SHALL reference an object present in the bound Authority selection and MAY assign that object to more than one registered domain. Every published concept in the bound Authority selection SHALL belong to at least one registered domain. The catalog SHALL retain one deterministic preferred navigation domain per object without changing canonical object identity or deleting secondary memberships.

#### Scenario: Object spans analysis and design domains
- **WHEN** reviewers assign one Authority object to multiple domains
- **THEN** each domain shard SHALL reference the same canonical object
- **AND** the runtime catalog SHALL retain its other reviewed domain memberships without duplicating the object as a separate knowledge fact

#### Scenario: Membership references an absent object
- **WHEN** a catalog member is not present in the bound Authority selection
- **THEN** the candidate catalog SHALL fail validation and the prior catalog SHALL remain available

#### Scenario: A published concept has no domain
- **WHEN** coverage validation finds a published concept in the bound Authority selection with zero domain memberships
- **THEN** the candidate catalog SHALL fail validation and the prior catalog SHALL remain available
