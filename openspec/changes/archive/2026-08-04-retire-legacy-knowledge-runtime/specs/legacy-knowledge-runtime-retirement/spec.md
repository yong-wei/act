## ADDED Requirements

### Requirement: Legacy retirement is evidence-gated and separate from activation
The system MUST refuse legacy runtime removal unless an immutable retirement manifest proves all declared preconditions. Retirement MUST be implemented and reviewed separately from any consumer activation change and MUST NOT modify activation pointers.

#### Scenario: Activation is complete but preconditions are missing
- **WHEN** a consumer activation manifest is current but fallback scan, rollback archive, or incremental-upgrade receipt is absent
- **THEN** retirement SHALL remain blocked
- **AND** no legacy reader or selector dependency SHALL be removed

#### Scenario: Activation and retirement are combined
- **WHEN** one change attempts to switch a consumer and delete its fallback reader
- **THEN** validation SHALL reject the change as out of contract

### Requirement: New content and active consumers have no legacy IDs
Before retirement, a deterministic scan MUST prove new authoring/runtime content does not reference legacy graph/card IDs and every active consumer resolves Canonical/Authority/Projection identities or an explicitly retained historical adapter.

#### Scenario: New old-ID reference is found
- **WHEN** current authoring, runtime, or active route content contains an old graph/card ID
- **THEN** retirement SHALL fail closed with the exact path and digest
- **AND** the legacy reader SHALL remain available

### Requirement: Fallback hits and upgrade evidence are complete
Retirement MUST require zero legacy fallback hits for each migrated consumer over a recorded evidence window, Canonical LearningFacts and Konling cutover, and at least one complete ActKG incremental upgrade through impact, rebuild, activation, and rollback checks.

#### Scenario: Fallback remains nonzero
- **WHEN** any migrated consumer records a legacy graph/card fallback hit in the evidence window
- **THEN** retirement SHALL remain blocked
- **AND** the hit and consumer SHALL be included in the diagnostics

#### Scenario: Incremental upgrade is incomplete
- **WHEN** no complete Delta upgrade receipt and rollback evidence exists
- **THEN** retirement SHALL fail closed even if current consumers appear ready

### Requirement: Historical evidence and rollback artifacts are retained
Retirement MUST retain the immutable 34-batch legacy audit manifest, old-to-Canonical crosswalk, historical Authority/Projection snapshots, LearningFact revision metadata, and digest-verified rollback archive. Removal MUST NOT rewrite or delete historical records.

#### Scenario: Historical fact is read after retirement
- **WHEN** a reader resolves a pre-cutover LearningFact or legacy audit record
- **THEN** the retained crosswalk/snapshot adapter SHALL provide historical context
- **AND** no new active selector or fact mutation SHALL be created

#### Scenario: Rollback archive is tampered
- **WHEN** archived rollback bytes or digest identity differ from the retirement manifest
- **THEN** retirement SHALL fail before deleting any runtime dependency
