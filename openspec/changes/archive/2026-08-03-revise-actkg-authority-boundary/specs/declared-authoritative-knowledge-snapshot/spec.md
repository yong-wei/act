## MODIFIED Requirements

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
