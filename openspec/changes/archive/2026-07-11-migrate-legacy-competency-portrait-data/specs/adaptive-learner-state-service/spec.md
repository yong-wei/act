## ADDED Requirements

### Requirement: Legacy learner portraits migrate to portrait v2 with lineage
The system SHALL provide an auditable migration path from legacy
six-dimensional learner portrait data to primary seven-dimensional portrait v2
records.

#### Scenario: Legacy snapshot is migrated
- **WHEN** a legacy six-dimensional snapshot is migrated
- **THEN** the resulting portrait v2 record SHALL include source snapshot refs, mapping version, mapping confidence, limitation metadata, original timestamp, and migration timestamp
- **AND** the migration SHALL NOT claim native portrait v2 evidence when values are compatibility-derived.

#### Scenario: Migration is rerun
- **WHEN** the migration apply path runs more than once
- **THEN** it SHALL be idempotent
- **AND** it SHALL NOT duplicate portrait rows or erase source lineage.

#### Scenario: Canonical fixture account is migrated
- **WHEN** Yang Fan diagnostic fixture data is generated or migrated
- **THEN** the canonical student number and canonical email SHALL identify the target account
- **AND** display-name-only duplicate accounts SHALL NOT receive fixture overwrite data.
