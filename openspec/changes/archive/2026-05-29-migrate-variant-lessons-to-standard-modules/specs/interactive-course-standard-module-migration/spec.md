## ADDED Requirements

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
