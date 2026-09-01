## ADDED Requirements

### Requirement: Learning Record writes have one reconciled owner boundary
All supported Learning Record writes SHALL resolve to one named canonical application/write boundary. Same-transaction domain operations SHALL call the existing typed boundary directly or be recorded as an explicit, owner-approved migration exception; cross-process operations SHALL stage one allowlisted input and submit it to that boundary. A producer MUST NOT independently write a fact and stage a second representation of the same logical action.

#### Scenario: Same-transaction producer writes a fact
- **WHEN** a trusted Assessment, Arena, Personalization or other domain operation writes a fact in its transaction
- **THEN** it SHALL call the canonical ingestion API and commit the fact plus its idempotent projection-trigger intent as one logical operation
- **AND** it SHALL NOT emit a synthetic event solely to reach the API

#### Scenario: Cross-process producer stages a fact
- **WHEN** a producer crosses a worker or process boundary
- **THEN** it SHALL stage one allowlisted outbox input with stable identity and anchors
- **AND** the worker SHALL submit that input to the canonical boundary without a second direct fact write

#### Scenario: Domain writer is not yet migrated
- **WHEN** an existing same-transaction domain writer has not yet moved to the canonical boundary
- **THEN** the reconciliation ledger SHALL record its owner, entry, identity, anchors, privacy policy, replacement and deletion condition
- **AND** the exception SHALL not be treated as permission for a parallel outbox or duplicate materialization

### Requirement: The write producer denominator is closed before deletion
The migration SHALL enumerate every online route, domain writer, worker, outbox, scheduler, historical backfill, report and test that can write or trigger Learning Record state. Each row SHALL identify owner, transport, dedupe identity, immutable anchors, trusted/server times, privacy class, consumer, verification evidence and deletion condition.

#### Scenario: A writer has no owner or replacement
- **WHEN** a producer or writer is missing from the current-revision denominator or lacks a replacement and rollback condition
- **THEN** reconciliation SHALL fail closed
- **AND** the path SHALL remain available or explicitly isolated until its status is resolved

#### Scenario: A duplicate writer is proven
- **WHEN** two paths materialize the same logical source identity
- **THEN** the ledger SHALL identify one canonical path and classify the other as deleted, isolated or retained audit-only
- **AND** database uniqueness MUST NOT be the sole evidence that the paths are safe together

### Requirement: Backfill writes remain explicit historical operations
Backfill, correction and replay writers SHALL carry an explicit operation identity, frozen input/cutoff and source anchors, and SHALL be prevented from silently publishing an online current projection or changing the original fact identity.

#### Scenario: Backfill runs without apply authorization
- **WHEN** a historical command runs in dry-run or without its required authorization and frozen input
- **THEN** it SHALL report candidates and limitations without writing facts, snapshots, pointers or online triggers

#### Scenario: Backfill derives a correction
- **WHEN** an authorized backfill derives a new result from an immutable source
- **THEN** it SHALL reference the original anchor and record an explicit correction/rematerialization relation
- **AND** it SHALL preserve append-only history and existing watermark semantics
