## MODIFIED Requirements

### Requirement: Duplicate materialization and raw aggregators are removed only after replacement
Duplicate fact materializers, legacy projection services and normal-page raw event aggregators SHALL be deleted only after canonical ingestion/current projection and stable read ports have revision-bound parity and zero required callers. Legitimate downstream caches MAY remain when their owner, input watermark, freshness and read contract are explicit. Authorized audit/debug/migration/drilldown operations MAY retain constrained historical access.

#### Scenario: Page loses current projection
- **WHEN** a normal page cannot obtain a qualified current projection after legacy removal
- **THEN** it returns governed stale/unavailable status and does not aggregate raw events, invoke backfill or fabricate zero values

#### Scenario: Cache is a declared downstream projection
- **WHEN** a cache has a required consumer and explicit revision/watermark/freshness provenance
- **THEN** it remains a downstream read projection rather than being deleted as duplicate authority
- **AND** it does not become a second current-pointer writer

#### Scenario: Duplicate path has no required caller
- **WHEN** static and dynamic evidence prove a duplicate projection path has zero required callers and parity with the current read port
- **THEN** it MAY be deleted
- **AND** rollback restores only the prior qualified current/code path without restoring raw fallback permissions
