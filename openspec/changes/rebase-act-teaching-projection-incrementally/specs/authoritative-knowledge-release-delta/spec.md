## MODIFIED Requirements

### Requirement: Delta emits generic downstream signals
ReleaseSet Delta MUST expose stable identity, category, predecessor/successor, relation, and source-anchor changes as generic downstream signals. It MUST NOT require ACT course review for unbound additions or decide whether a teaching consumer should activate; ACT projection rebase owns that scoped impact calculation.

#### Scenario: Downstream ACT consumer reads Delta
- **WHEN** a validated Delta is available for a new Authority Snapshot
- **THEN** the consumer SHALL receive exact changed identities and categories
- **AND** it SHALL calculate its own ACT impact set without changing Delta authority

#### Scenario: Delta has unbound additions
- **WHEN** only unbound engineering objects are added
- **THEN** the Delta SHALL remain valid
- **AND** no global CourseCoverage or Teaching Projection review SHALL be synthesized

### Requirement: Delta processing does not activate authority
Delta processing and ACT rebase MUST leave current Authority and consumer pointers unchanged until explicit activation of a fully materialized snapshot.

#### Scenario: Rebase is staged
- **WHEN** ACT computes an impact set and rebuilt projection for a Delta
- **THEN** current consumers SHALL continue using their prior combination
- **AND** staged failures SHALL not partially replace runtime artifacts
