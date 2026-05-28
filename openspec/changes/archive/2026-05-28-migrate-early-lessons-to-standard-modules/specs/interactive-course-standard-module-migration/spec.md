## ADDED Requirements

### Requirement: Early lessons use standard modules
The system SHALL migrate lessons 2-1, 2-2, 2-3, 2-4, 3-1, 3-2, 3-3, and 3-4 to the canonical interactive module taxonomy.

#### Scenario: Early lesson manifests contain canonical modules
- **WHEN** the module registry gate scans 2-1, 2-2, 2-3, 2-4, 3-1, 3-2, 3-3, or 3-4
- **THEN** each visible module SHALL resolve to a canonical module class
- **AND** migrated lessons SHALL NOT rely on lesson-private module kinds.

#### Scenario: Empty early manifests are populated
- **WHEN** an early lesson previously had a runtime manifest with zero modules
- **THEN** the migrated manifest SHALL include standard modules sufficient to render the existing student and teacher page content
- **AND** existing route segments, step ids, and classroom behavior SHALL remain stable.

#### Scenario: Early response evidence remains governed
- **WHEN** a migrated early lesson collects a student response
- **THEN** it SHALL continue to use the shared manifest submission evidence path
- **AND** custom workspace output SHALL be preserved as structured extra evidence rather than mutable state only.
