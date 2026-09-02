## MODIFIED Requirements

### Requirement: Raw access is restricted to explicit operations
Raw events MAY be read only for authorized audit, debug, migration or drilldown operations carrying a purpose and revision-bound receipt. Pages, normal APIs, AI context and Personalization runtime MUST NOT use raw fallback or invoke a backfill/materialization command to bypass a projection status.

#### Scenario: Raw fallback attempt
- **WHEN** a normal consumer cannot obtain a current projection and attempts to query raw event history or invoke backfill
- **THEN** it returns the governed unavailable/stale state and does not read raw events or historical working data

#### Scenario: Authorized historical operation
- **WHEN** an authorized audit, debug, migration or drilldown operation requests historical data
- **THEN** it MUST carry purpose, actor scope, source revision and a durable operation receipt
- **AND** its raw permission MUST remain physically and logically separate from normal consumer permissions

### Requirement: Consumer migration denominator is closed
Migration SHALL enumerate all consumer routes, pages, services, workers, backfills and reports, their current raw/legacy callers, replacement port, owner and deletion condition. It SHALL distinguish normal online callers from explicit historical-operation callers before removing an entry point.

#### Scenario: Legacy reader deletion
- **WHEN** a legacy reader or backfill fallback is proposed for removal
- **THEN** the ledger proves zero normal callers, migrated historical callers, replacement receipts and aligned online/backfill paths before deletion
