## ADDED Requirements

### Requirement: Production delivery preserves the complete accepted local knowledge set
The release process SHALL capture all accepted local Authority, teaching-order, resource-binding, domain-shard and locale artifacts needed by the product into one verified candidate. It SHALL reject missing accepted members, mixed identities, stale qualification packages and incompatible application/Runtime combinations before activation. Application and Runtime revisions MAY differ only through the existing explicit compatibility evidence. A code-only update SHALL NOT silently leave incompatible old knowledge selectors active.

#### Scenario: Application registration is newer than the active snapshot
- **WHEN** the candidate application expects a locale package or shard family absent from the selected knowledge combination
- **THEN** publication validation SHALL reject the incompatible selection before product activation

#### Scenario: Accepted resource bindings are missing from a candidate
- **WHEN** the local accepted resource set includes a valid binding omitted by candidate assembly
- **THEN** continuity validation SHALL fail and preserve the previous complete production combination

#### Scenario: Activate a complete candidate
- **WHEN** the candidate passes identity, continuity and application compatibility checks
- **THEN** the coordinated publication SHALL verify the same combination in production, including English, teaching prerequisites and real resource launches
