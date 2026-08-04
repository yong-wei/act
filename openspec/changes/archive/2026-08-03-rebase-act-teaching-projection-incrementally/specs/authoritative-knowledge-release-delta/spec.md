## MODIFIED Requirements

### Requirement: Delta emits generic downstream signals
An accepted semantic Delta SHALL emit stable object-, relation-, Crosswalk-, component-, Projection-, and vocabulary-scoped candidate or invalidation signals. These signals MUST describe affected identities and reasons without deciding course coverage, resource roles, teaching relations, or consumer activation. ReleaseSet Delta MUST expose stable identity, category, predecessor/successor, relation, and source-anchor changes as generic downstream signals. It MUST NOT require ACT course review for unbound additions or decide whether a teaching consumer should activate; ACT projection rebase owns that scoped impact calculation.

#### Scenario: Object payload changes
- **WHEN** a valid Canonical Object payload changes without breaking identity
- **THEN** the system SHALL invalidate dependent summaries and emit an object governance candidate while preserving its Canonical ID

#### Scenario: Crosswalk row is removed
- **WHEN** a Crosswalk triple present in the base is absent from the candidate
- **THEN** the system SHALL emit a Crosswalk invalidation signal and SHALL NOT itself select or delete an ACT structural-unit binding

#### Scenario: Downstream ACT consumer reads Delta
- **WHEN** a validated Delta is available for a new Authority Snapshot
- **THEN** the consumer SHALL receive exact changed identities and categories
- **AND** it SHALL calculate its own ACT impact set without changing Delta authority

#### Scenario: Delta has unbound additions
- **WHEN** only unbound engineering objects are added
- **THEN** the Delta SHALL remain valid
- **AND** no global CourseCoverage or Teaching Projection review SHALL be synthesized

### Requirement: Delta processing does not activate authority
Generating or accepting a Delta Receipt MUST NOT move candidate, active, or Legacy selectors and MUST NOT directly run a production consumer migration. Delta computation SHALL remain a pure validated input to staged Authority Snapshot materialization. Delta processing and ACT rebase MUST leave current Authority and consumer pointers unchanged until explicit activation of a fully materialized snapshot. Current Authority and consumer pointers SHALL change only through the explicit atomic activation operation.

#### Scenario: Delta Receipt is accepted
- **WHEN** recomputation and upstream cross-validation pass
- **THEN** the candidate ReleaseSet SHALL remain non-production and all production consumers SHALL retain their existing authority

#### Scenario: Delta succeeds before activation
- **WHEN** a Delta receipt is valid but activation has not been requested
- **THEN** the candidate snapshot SHALL remain staged/non-current
- **AND** existing consumers SHALL continue using their prior pointer

#### Scenario: Rebase is staged
- **WHEN** ACT computes an impact set and rebuilt projection for a Delta
- **THEN** current consumers SHALL continue using their prior combination
- **AND** staged failures SHALL not partially replace runtime artifacts
