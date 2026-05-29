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

### Requirement: Stable lesson group uses standard modules
The system SHALL migrate 4-1, 4-2, 4-3, 4-4, 4-5, 4-6, 4-7, 5-1, 5-2, 5-3, 5-4, 5-5, 5-6, and cruise-comfort to canonical module classes.

#### Scenario: Stable lessons pass module gates
- **WHEN** standard module gates scan the stable lesson group
- **THEN** every visible module SHALL resolve to a canonical module class
- **AND** migrated lessons SHALL NOT require alias-only course-local registry entries.

#### Scenario: Teacher controls remain stable
- **WHEN** a migrated stable lesson uses teacher release, browse, reveal, answer visibility, or training controls
- **THEN** those controls SHALL preserve current classroom behavior
- **AND** module standardization SHALL NOT remove teacher-controlled visibility semantics.

#### Scenario: Compute panels are capability-bound
- **WHEN** a migrated stable lesson uses rust, interactive figure, analysis, or training panels
- **THEN** the manifest SHALL represent that behavior as `compute.panel`, `activity.workspace`, or an approved standard activity
- **AND** the panel SHALL carry a registered capability reference or an explicit migration exception.

### Requirement: Existing interactive lessons are fully migrated
The system SHALL track every existing runtime-first interactive lesson as migrated to the standard module framework before legacy aliases are removed.

#### Scenario: Full inventory is covered
- **WHEN** the final strict gate runs
- **THEN** the migrated inventory SHALL include all existing runtime-first interactive lessons
- **AND** any missing lesson SHALL fail the gate.

#### Scenario: All migrated lessons pass strict validation
- **WHEN** a migrated lesson is in the inventory
- **THEN** it SHALL pass canonical module, canonical response, submission evidence, and finalization gates
- **AND** it SHALL NOT require a lesson-private module-kind exception.
