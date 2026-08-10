# declared-authoritative-knowledge-snapshot Specification

## Purpose
TBD - created by archiving change cut-over-authoritative-knowledge-and-archive-legacy. Update Purpose after archive.
## Requirements
### Requirement: Snapshot is resolved and frozen from one declared source boundary
The system MUST create a declared-authoritative snapshot only after resolving one admissible ReleaseSet endpoint and freezing its `releaseSetId`, Release identity/hash, Bundle identity/digest, Schema version/raw hash, Projection identity/digest, source dataset digest, accepted import receipt, every accepted Delta receipt, ACT capture revision, and resolution digest. The snapshot is immutable evidence of a validated release and MAY be staged as a candidate or selected as Engineering Authority only through an explicit activation transaction; snapshot materialization itself MUST NOT change a selector.

#### Scenario: All frozen identities match
- **WHEN** the resolved Bundle, Release, Schema, Projection, import receipts, Delta receipts, and ACT capture all match the frozen values
- **THEN** the snapshot SHALL be readable as one declared-authoritative evidence set
- **AND** it SHALL be eligible for explicit Engineering Authority staging without CourseCoverage closure

#### Scenario: One identity or digest drifts
- **WHEN** any frozen identity, digest, receipt, capture revision, or declared source boundary differs
- **THEN** snapshot materialization and any Authority activation SHALL fail closed without emitting a replacement or partial snapshot

#### Scenario: Explicit Authority activation is requested
- **WHEN** a validated snapshot is selected by the Authority activation operation and its manifest/pointer digest still matches
- **THEN** the activation transaction MAY publish it through the atomic Authority current pointer
- **AND** snapshot creation alone SHALL not activate Engineering Authority, teaching consumers, or Canonical writers

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
A declared ActKG snapshot MUST remain evidence of a verified release. Snapshot materialization alone MUST NOT change production selectors. An integrity-valid snapshot MAY activate Engineering Authority only through an explicit activation transaction and without CourseCoverage closure or a Teaching Projection. Teaching, KAQ, path, resource, and learning-fact consumers SHALL remain blocked, Legacy, or pinned only when their own projection, binding, or consumer gate is unresolved.

#### Scenario: Snapshot is mistaken for cutover proof
- **WHEN** a caller attempts to use snapshot materialization alone to activate public candidate mode, a formal teaching consumer, or a Canonical writer
- **THEN** the request SHALL be rejected for those consumers
- **AND** production teaching selectors SHALL remain unchanged until their own gates pass

#### Scenario: Valid snapshot has no teaching projection
- **WHEN** the declared source identities, hashes, schema, endpoints, receipts, and capture all match and the ACT Teaching Projection is empty
- **THEN** Engineering Authority MAY become `ACTIVE` through the explicit Authority activation path
- **AND** teaching consumers SHALL report their local `NOT_PROJECTED` dependency

#### Scenario: Integrity identity drifts
- **WHEN** any frozen ActKG identity, hash, receipt, schema, endpoint, or capture differs
- **THEN** Authority activation SHALL fail closed
- **AND** no consumer selector SHALL advance

### Requirement: Later snapshots extend history without rewriting it

A later accepted Release MAY produce a new snapshot with a new frozen identity and digest, but an existing snapshot's ReleaseSet membership, receipts, input digest, and blocked/selector-invariance evidence MUST be immutable.

#### Scenario: A later Release is resolved

- **WHEN** a newer stable Release passes the same declared-source checks
- **THEN** the system SHALL create a new snapshot while retaining the prior snapshot byte-for-byte

#### Scenario: An old snapshot is edited in place

- **WHEN** a caller attempts to replace an old snapshot's identities, worklist, receipts, or verdict state
- **THEN** the write SHALL be rejected as provenance drift

