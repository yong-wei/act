# declared-authoritative-knowledge-snapshot Specification

## Purpose
TBD - created by archiving change cut-over-authoritative-knowledge-and-archive-legacy. Update Purpose after archive.
## Requirements
### Requirement: Snapshot is resolved and frozen from one declared source boundary

The system MUST create a declared-authoritative snapshot only after resolving one admissible ReleaseSet endpoint and freezing its `releaseSetId`, Release identity/hash, Bundle identity/digest, Schema version/raw hash, Projection identity/digest, source dataset digest, accepted import receipt, every accepted Delta receipt, ACT capture revision, and resolution digest. A snapshot MUST be evidence of a read-only candidate state and MUST NOT be treated as production authority.

#### Scenario: All frozen identities match

- **WHEN** the resolved Bundle, Release, Schema, Projection, import receipts, Delta receipts, and ACT capture all match the frozen values
- **THEN** the snapshot SHALL be readable as one declared-authoritative evidence set

#### Scenario: One identity or digest drifts

- **WHEN** any frozen identity, digest, receipt, capture revision, or declared source boundary differs
- **THEN** snapshot materialization SHALL fail closed without emitting a replacement or partial snapshot

### Requirement: Snapshot reads are isolated and provenance-closed

All locked Release, Projection, Bundle, and worklist files MUST belong to the same immutable ACT capture. During snapshot creation, all corresponding import and Delta rows MUST be read from one isolated database snapshot bound to that capture, and their relevant identities, states, hashes, relationships, and capture revision MUST be frozen into the immutable receipt. Materialized validation MUST reject a receipt whose independently pinned full-payload digest, schema, row identities, relationships, or capture binding differs. Once frozen, the historical snapshot MUST NOT depend on continued availability or later mutable state of the source database; later database drift requires a new capture attempt and MUST NOT rewrite or invalidate the retained snapshot.

#### Scenario: Isolated loader and Delta chain agree

- **WHEN** the formal Bundle loader, sequential Delta checks, and database round-trip all agree in the isolated snapshot
- **THEN** the snapshot SHALL retain their receipts and exact provenance

#### Scenario: Input is mixed across captures

- **WHEN** a worklist or receipt comes from another schema, capture revision, Release, or Delta chain
- **THEN** the validator SHALL reject it before exposing worklist or downstream evidence

### Requirement: CourseCoverage worklist remains pending review input

The snapshot MAY include a deterministic CourseCoverage worklist, but the worklist MUST remain an input set rather than an accepted Coverage authority. Its membership, input digest, Release/Delta binding, and profile-only evidence state MUST be explicit; a profile-only item MUST NOT imply a role, disposition, or accepted Coverage row.

#### Scenario: Deterministic worklist is generated

- **WHEN** the frozen r3 snapshot generates the 3,609-item worklist
- **THEN** repeated generation SHALL produce the same membership and input digest without manufacturing review decisions

#### Scenario: Profile-only evidence is present

- **WHEN** one of the 1,772 profile-only items has no independent reviewer decision bound to the current worklist digest
- **THEN** the item SHALL remain pending and SHALL NOT enter CURRENT/SHADOW CourseCoverage

#### Scenario: Historical verdict is available

- **WHEN** an older Coverage verdict references the same canonical ID
- **THEN** it MAY be used as a historical lookup hint but SHALL NOT be copied into the current snapshot authority

### Requirement: Downstream activation remains blocked and selectors remain unchanged

Until an independent follow-up change completes CourseCoverage review, role-type contracts, formal Teaching Projection, handoff/attestation, and all consumer gates, Teaching Projection and the two unresolved role mappings MUST remain blocked, other formal consumers MUST remain blocked or Legacy, and production selector changes MUST remain exactly zero.

#### Scenario: Snapshot is mistaken for cutover proof

- **WHEN** a caller attempts to use the snapshot to activate public candidate mode, a formal consumer, or a Canonical writer
- **THEN** the request SHALL be rejected and all production selectors SHALL remain unchanged

### Requirement: Later snapshots extend history without rewriting it

A later accepted Release MAY produce a new snapshot with a new frozen identity and digest, but an existing snapshot's ReleaseSet membership, receipts, input digest, and blocked/selector-invariance evidence MUST be immutable.

#### Scenario: A later Release is resolved

- **WHEN** a newer stable Release passes the same declared-source checks
- **THEN** the system SHALL create a new snapshot while retaining the prior snapshot byte-for-byte

#### Scenario: An old snapshot is edited in place

- **WHEN** a caller attempts to replace an old snapshot's identities, worklist, receipts, or verdict state
- **THEN** the write SHALL be rejected as provenance drift
