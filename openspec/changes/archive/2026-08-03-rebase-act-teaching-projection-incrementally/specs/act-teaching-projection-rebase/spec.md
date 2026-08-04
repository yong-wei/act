## ADDED Requirements

### Requirement: Rebase computes an ACT impact set from ReleaseSet Delta
The system MUST calculate a deterministic impact set from one accepted Authority/ReleaseSet Delta and current ACT projection records. The impact set MUST include exact changed identities, categories, dependent resources/cards/prerequisites/textbook locators, and leave unbound new engineering nodes outside the ACT review denominator.

#### Scenario: Delta adds unbound nodes
- **WHEN** a ReleaseSet Delta adds nodes with no current ACT binding
- **THEN** the impact set SHALL contain zero teaching-review items for those nodes
- **AND** Engineering Authority MAY accept the additions

#### Scenario: Bound node metadata changes
- **WHEN** a Delta changes a Canonical label, alias, type, or semantic payload
- **THEN** only direct bindings and their dependent teaching records SHALL enter the impact set

### Requirement: Safe one-to-one successors rebase deterministically
An ordinary resource binding MAY auto-rebase only when the deprecated Canonical has one type-compatible successor and no split/merge ambiguity. Label/alias-only changes MUST rebuild display indexes without changing binding identity.

#### Scenario: Single successor exists
- **WHEN** a bound node is deprecated with one compatible `REPLACED_BY` successor
- **THEN** ordinary resource bindings SHALL rebase with an immutable audit decision
- **AND** cards/prerequisites SHALL be flagged for their own local checks

#### Scenario: Split or merge exists
- **WHEN** a node has multiple successors, predecessors, a split, a merge, or no successor
- **THEN** affected records SHALL become `REVIEW_REQUIRED`
- **AND** unaffected consumers SHALL retain their prior valid projection

### Requirement: Human work is incremental but runtime rebuild is complete
The builder MUST combine carried-forward, auto-rebased, and newly authored records into a complete new Projection Snapshot with deterministic artifacts and hash. It MUST NOT patch an existing runtime file in place.

#### Scenario: Unaffected records are carried forward
- **WHEN** a Delta affects only one resource group
- **THEN** unaffected records SHALL retain their prior semantic digest in the rebuilt snapshot
- **AND** the old snapshot SHALL remain immutable

#### Scenario: Repeated rebase runs
- **WHEN** identical Authority, Delta, projection, and decisions are processed twice
- **THEN** impact report, decisions, artifacts, and Projection hash SHALL be byte-identical
