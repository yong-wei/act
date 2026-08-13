# authority-domain-display-catalog Specification

## Purpose
TBD - created by archiving change define-authority-domain-display-catalog. Update Purpose after archive.
## Requirements
### Requirement: Authority navigation uses a reviewed domain catalog
The system SHALL publish a versioned display catalog containing exactly the eight registered engineering domains `system-modeling`, `time-domain-analysis`, `stability-analysis`, `frequency-domain-analysis`, `root-locus`, `classical-control-design`, `discrete-time-control-analysis`, and `state-space-control-analysis-and-design`. The control-theory integration component SHALL be an aggregate navigation entry and SHALL NOT be counted as a ninth peer domain.

#### Scenario: Root catalog is published
- **WHEN** the display catalog passes review and validation against one Authority selection
- **THEN** the root projection SHALL expose the eight domains in reviewed order plus one separately typed aggregate entry
- **AND** none of those presentation entries SHALL be represented as an Authority object or relation

#### Scenario: Catalog invents an unregistered domain
- **WHEN** a catalog version contains an unregistered peer domain or promotes the aggregate entry to a peer domain
- **THEN** publication SHALL fail closed

### Requirement: Domain membership is reviewed and many-to-many
Each catalog member SHALL reference an object present in the bound Authority selection and MAY assign that object to more than one registered domain. The catalog SHALL retain one deterministic preferred navigation domain without changing canonical object identity or deleting secondary memberships.

#### Scenario: Object spans analysis and design domains
- **WHEN** reviewers assign one Authority object to multiple domains
- **THEN** each domain shard SHALL reference the same canonical object
- **AND** the runtime catalog SHALL retain its other reviewed domain memberships without duplicating the object as a separate knowledge fact

#### Scenario: Membership references an absent object
- **WHEN** a catalog member is not present in the bound Authority selection
- **THEN** the candidate catalog SHALL fail validation and the prior catalog SHALL remain available

### Requirement: Domain presentation is human-readable and source-safe
Every domain and aggregate entry SHALL have reviewed Chinese name, summary, order and presentation role. Product-visible text, accessible names, tooltips and copy surfaces SHALL NOT contain catalog keys, Authority object identifiers, release identifiers, hashes or raw enum values.

#### Scenario: Root navigation DTO is projected
- **WHEN** the runtime catalog is projected into a root navigation DTO
- **THEN** each entry SHALL be identified by its reviewed human name and summary
- **AND** no internal catalog or Authority identity SHALL be exposed
