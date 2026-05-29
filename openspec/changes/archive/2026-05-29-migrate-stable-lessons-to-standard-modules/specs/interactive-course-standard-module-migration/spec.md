## ADDED Requirements

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
