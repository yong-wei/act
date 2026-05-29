## Purpose

Define the migration coverage contract for moving interactive course runtime manifests from legacy or empty module declarations to canonical standard module manifests.
## Requirements
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

### Requirement: Variant-heavy lessons use standard modules
The system SHALL migrate lessons 3-5, 3-6, 3-7, 3-8, and 3-9 to canonical modules and canonical response contracts.

#### Scenario: One-off variants are removed from migrated manifests
- **WHEN** the module registry gate scans a migrated 3-5, 3-6, 3-7, 3-8, or 3-9 manifest
- **THEN** one-off module kinds such as `derivation-reveal`, `step-reveal-list`, `parametric-workspace`, `frequency-band-labeling`, `phase-peak-locator`, and `scenario-sort-matrix` SHALL NOT appear
- **AND** their behavior SHALL be represented through canonical module classes and fields.

#### Scenario: Compute and workspace behavior remains functional
- **WHEN** a migrated variant-heavy lesson previously used a parameter, root-locus, phase-peak, or other compute workspace
- **THEN** the migrated lesson SHALL preserve the student-facing workflow
- **AND** the output SHALL be captured through a registered compute capability, `activity.workspace`, or structured extra evidence.

#### Scenario: Variant-heavy lessons pass shared gates
- **WHEN** standard module, response, and submission gates run
- **THEN** 3-5, 3-6, 3-7, 3-8, and 3-9 SHALL pass without lesson-private module-kind exceptions.
