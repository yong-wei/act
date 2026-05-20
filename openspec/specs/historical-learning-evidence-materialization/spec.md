# historical-learning-evidence-materialization Specification

## Purpose
Define the governed backfill path that converts eligible historical and out-of-class learning evidence into traceable, idempotent `LearningFact` records without mutating raw source tables.
## Requirements
### Requirement: Historical evidence materialization is catalog-driven
The system SHALL materialize historical and out-of-class learning evidence only through adapters that consume the governed evidence source catalog.

#### Scenario: Adapter follows catalog eligibility
- **WHEN** a materialization adapter inspects a source family
- **THEN** it SHALL use the catalog's provenance, learning scope, value level, profile eligibility, and materialization readiness policy
- **AND** it SHALL NOT emit profile-grade candidates for sources marked context-only, unsupported, seed, showcase, demo, or test.

#### Scenario: Eligible high-value source emits candidate
- **WHEN** a source row belongs to a catalog-approved high-value or explicitly materialization-ready source family
- **THEN** the adapter SHALL emit an evidence candidate with user id, source family, stable source identity, source timestamp, evidence subtype, trace reference, and confidence metadata.

### Requirement: Materialization supports dry-run before apply
The system SHALL provide dry-run and apply modes for historical evidence materialization.

#### Scenario: Dry-run writes nothing
- **WHEN** the materialization command runs in dry-run mode
- **THEN** it SHALL report candidate counts, excluded counts, unsupported counts, affected users, source windows, and sample trace references
- **AND** it SHALL NOT create, update, or delete `LearningFact`, snapshot, summary, feature, or raw source rows.

#### Scenario: Apply writes derived facts only
- **WHEN** the materialization command runs in apply mode
- **THEN** it SHALL write only derived governance facts for eligible evidence candidates
- **AND** it SHALL preserve all raw source rows unchanged.

### Requirement: Materialization is idempotent and traceable
The system SHALL prevent duplicate facts when historical materialization is repeated and SHALL retain traceability to raw source records.

#### Scenario: Repeated apply is stable
- **WHEN** apply mode is run more than once against the same source data
- **THEN** the second and later runs SHALL NOT create duplicate facts for candidates with the same stable source identity
- **AND** the run summary SHALL report already-materialized candidates separately from newly-created facts.

#### Scenario: Fact points to source evidence
- **WHEN** a derived fact is created from historical evidence
- **THEN** it SHALL include enough source metadata to identify the source family, source record or deterministic source key, evidence subtype, and original timestamp
- **AND** downstream audits SHALL be able to connect the fact back to the raw evidence source without reading ambiguous free-text fields.
