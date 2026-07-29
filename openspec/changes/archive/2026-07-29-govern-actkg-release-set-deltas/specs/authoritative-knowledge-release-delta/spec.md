## ADDED Requirements

### Requirement: ReleaseSet Delta is recomputed from accepted database snapshots
The system MUST compute each ReleaseSet Delta from one fully verified base ReleaseSet and one fully verified candidate ReleaseSet persisted by ACT, using stable semantic identities and deterministic ordering.

#### Scenario: Prior accepted ReleaseSet exists
- **WHEN** a new candidate Bundle completes transactional import and round-trip verification
- **THEN** the system SHALL compare its persisted semantic snapshot with the previous accepted ReleaseSet

#### Scenario: No prior accepted ReleaseSet exists
- **WHEN** the first standard candidate completes import
- **THEN** the system SHALL emit a `BASELINE` Delta with the candidate semantic members represented as additions

### Requirement: Delta covers every governed semantic collection
The Delta MUST report object additions/removals/payload/type/tier/supersession changes; relation additions/removals/predicate/direction/tier/endpoint changes; Crosswalk additions/removals; component additions/removals/changes; Projection profile additions/removals/digest changes; and vocabulary type/predicate additions.

#### Scenario: Release adds only relations
- **WHEN** node membership is unchanged and valid relations are added
- **THEN** the Delta SHALL contain only the relation and any resulting vocabulary changes, with no fabricated object changes

#### Scenario: Component is added
- **WHEN** a candidate ReleaseSet adds a valid component and its semantic members
- **THEN** the Delta SHALL record the component and the exact object, relation, Crosswalk, Projection, and vocabulary changes attributable to the new snapshot

### Requirement: Upstream Diff is cross-checked but not trusted as authority
When a Bundle declares a required upstream release-diff Artifact, ACT MUST compare every mutually supported semantic difference against its own recomputation and MUST reject downstream authorization on disagreement.

#### Scenario: Upstream and ACT Diff agree
- **WHEN** the upstream Diff and ACT recomputation describe the same supported changes
- **THEN** the Delta Receipt SHALL record successful cross-validation

#### Scenario: Upstream and ACT Diff disagree
- **WHEN** either side omits or contradicts a supported object, relation, Crosswalk, component, or Projection change
- **THEN** no downstream governance signal SHALL be authorized

### Requirement: Canonical identity violations fail closed
The Delta calculator MUST reject an ungoverned canonical type change, a material identity-semantic replacement under the same Canonical ID, or an endpoint/direction replacement presented as an in-place relation update without the required new identity or supersession.

#### Scenario: Canonical type changes under one ID
- **WHEN** the base and candidate assign different canonical types to the same Canonical ID without an accepted supersession contract
- **THEN** Delta computation SHALL fail with an identity-integrity violation

#### Scenario: Valid supersession is declared
- **WHEN** the candidate retires an object and adds a replacement through a supported supersession contract
- **THEN** the Delta SHALL preserve the removal, addition, and supersession as distinct governed changes

### Requirement: Packaging revisions do not create semantic work
The system MUST classify a new Bundle as a packaging revision when Release ID/hash, source dataset hash, and semantic Artifact digests are unchanged, and MUST NOT emit semantic additions, removals, invalidations, or recomputation candidates for that revision.

#### Scenario: Manifest-only correction is imported
- **WHEN** a new Bundle revision corrects Manifest metadata while preserving all semantic identities and digests
- **THEN** the Delta SHALL record `COMPATIBLE_PACKAGING_REVISION` with an empty semantic change set

### Requirement: Delta Receipt is immutable and idempotent
Each `ReleaseSetDeltaReceipt` MUST bind base/candidate Bundle, ReleaseSet, Release and Projection identities, all input digests, algorithm version, ACT capture revision, classification, detailed changes and summary counts. Recomputing the same inputs MUST return the same semantic receipt without duplicates.

#### Scenario: Same Delta is computed twice
- **WHEN** identical base/candidate identities and input digests are submitted concurrently or repeatedly
- **THEN** the system SHALL retain one semantically identical receipt and one stable set of signals

#### Scenario: Receipt identity conflicts
- **WHEN** an existing receipt key is reused with different inputs or output digest
- **THEN** the system SHALL reject the conflict and preserve the original receipt

### Requirement: Delta emits generic downstream signals
An accepted semantic Delta SHALL emit stable object-, relation-, Crosswalk-, component-, Projection-, and vocabulary-scoped candidate or invalidation signals. These signals MUST describe affected identities and reasons without deciding course coverage, resource roles, teaching relations, or consumer activation.

#### Scenario: Object payload changes
- **WHEN** a valid Canonical Object payload changes without breaking identity
- **THEN** the system SHALL invalidate dependent summaries and emit an object governance candidate while preserving its Canonical ID

#### Scenario: Crosswalk row is removed
- **WHEN** a Crosswalk triple present in the base is absent from the candidate
- **THEN** the system SHALL emit a Crosswalk invalidation signal and SHALL NOT itself select or delete an ACT structural-unit binding

### Requirement: Delta processing does not activate authority
Generating or accepting a Delta Receipt MUST NOT move candidate, active, or Legacy selectors and MUST NOT directly run a production consumer migration.

#### Scenario: Delta Receipt is accepted
- **WHEN** recomputation and upstream cross-validation pass
- **THEN** the candidate ReleaseSet SHALL remain non-production and all production consumers SHALL retain their existing authority
