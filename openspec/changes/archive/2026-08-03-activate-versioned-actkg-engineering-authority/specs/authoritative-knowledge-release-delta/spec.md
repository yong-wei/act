## MODIFIED Requirements

### Requirement: Delta Receipt is immutable and idempotent
Each `ReleaseSetDeltaReceipt` MUST bind base/candidate Bundle, ReleaseSet, Release and Projection identities, all input digests, algorithm version, ACT capture revision, classification, detailed changes and summary counts. Recomputing the same inputs MUST return the same semantic receipt without duplicates. Each Authority Snapshot MUST bind the accepted Delta receipt chain and MUST produce the same snapshot identity for the same validated base, candidate, and capture. Recomputing Delta or materializing a snapshot MUST NOT create CourseCoverage work merely because an engineering object is added.

#### Scenario: Same Delta is computed twice
- **WHEN** identical base/candidate identities and input digests are submitted concurrently or repeatedly
- **THEN** the system SHALL retain one semantically identical receipt and one stable set of signals

#### Scenario: Receipt identity conflicts
- **WHEN** an existing receipt key is reused with different inputs or output digest
- **THEN** the system SHALL reject the conflict and preserve the original receipt

#### Scenario: Same ReleaseSet is imported again
- **WHEN** the same base/candidate ReleaseSet and Delta receipts are processed again
- **THEN** the existing snapshot identity MAY be reused
- **AND** no duplicate snapshot or teaching-review item SHALL be created

#### Scenario: Unrelated object is added
- **WHEN** a Delta adds an ActKG object with no ACT binding
- **THEN** the Delta SHALL record the engineering addition
- **AND** Authority materialization SHALL not require a teaching review

### Requirement: Delta processing does not activate authority
Generating or accepting a Delta Receipt MUST NOT move candidate, active, or Legacy selectors and MUST NOT directly run a production consumer migration. Delta computation SHALL remain a pure validated input to staged Authority Snapshot materialization. Current Authority and consumer pointers SHALL change only through the explicit atomic activation operation.

#### Scenario: Delta Receipt is accepted
- **WHEN** recomputation and upstream cross-validation pass
- **THEN** the candidate ReleaseSet SHALL remain non-production and all production consumers SHALL retain their existing authority

#### Scenario: Delta succeeds before activation
- **WHEN** a Delta receipt is valid but activation has not been requested
- **THEN** the candidate snapshot SHALL remain staged/non-current
- **AND** existing consumers SHALL continue using their prior pointer
