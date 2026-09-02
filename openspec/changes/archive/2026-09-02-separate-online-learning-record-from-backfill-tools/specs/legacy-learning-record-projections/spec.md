## MODIFIED Requirements

### Requirement: Retirement is gated by a closed denominator
Legacy Learning Record runtime SHALL be retired only after a revision-bound ledger enumerates every online producer/consumer, worker, backfill, report, queue, materializer, raw aggregator and test, with a migrated replacement, owner, watermark/digest receipt, privacy validation, operation-mode separation and rollback condition.

#### Scenario: Missing ledger row
- **WHEN** a legacy component has an unknown caller, mixed online/backfill use or missing replacement/receipt
- **THEN** retirement fails closed and the component remains available for safe operation

#### Scenario: All callers are migrated
- **WHEN** zero required online callers are proven, historical callers use the explicit backfill/audit lane, and all replacement receipts are valid
- **THEN** the component becomes eligible for the explicitly ordered deletion step

### Requirement: Duplicate materialization and raw aggregators are removed only after replacement
Duplicate fact materializers, legacy projection services, normal-page raw event aggregators and obsolete production backfill registrations SHALL be deleted only after canonical ingestion/current projection and stable read ports have revision-bound parity, historical callers are isolated, and zero required callers are proven. Authorized audit/debug/migration/drilldown operations MAY retain constrained historical access.

#### Scenario: Page loses current projection
- **WHEN** a normal page cannot obtain a qualified current projection after a legacy or backfill fallback is removed
- **THEN** it returns governed stale/unavailable status and does not aggregate raw events or invoke backfill as fallback
