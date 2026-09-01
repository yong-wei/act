## ADDED Requirements

### Requirement: Legacy projection removal is gated by online and backfill separation
Legacy readers, raw aggregators, duplicate materializers, caches and fallback paths SHALL be removed only after all normal callers use the qualified current projection, all historical callers use the explicit backfill/audit lane, and output, privacy, watermark and rollback parity are recorded for the target revision.

#### Scenario: Online caller remains
- **WHEN** a page, API, worker or report still requires a legacy projection path
- **THEN** the deletion gate SHALL fail closed
- **AND** the path SHALL remain available or be explicitly isolated until a replacement receipt exists

#### Scenario: All callers are separated
- **WHEN** normal and historical caller scans show no required legacy caller and replacement receipts are valid
- **THEN** the legacy path MAY be deleted
- **AND** rollback SHALL restore only the previous code/pointer without restoring raw fallback permissions

### Requirement: Legacy retirement does not alter append-only evidence
Projection simplification and legacy retirement MUST preserve LearningFacts, immutable snapshots, transitions, outbox receipts, official Arena results, current-pointer fence history and authorized audit records.

#### Scenario: Retirement is rolled back
- **WHEN** parity or deployment verification finds a regression
- **THEN** the system SHALL restore the previous qualified current or runtime path
- **AND** it SHALL retain all historical evidence and failure/deletion receipts
