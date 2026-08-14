## MODIFIED Requirements

### Requirement: Student profile preview training statistics use verified evidence
The system SHALL count only completed, student-scoped virtual simulation runs with an explicit preview boundary, `officialEligible=false`, and complete quality metrics in the profile preview training statistics. `total`, `previewCount`, and `recentRuns` SHALL derive from the same projected evidence set.

#### Scenario: Incomplete and invalid runs are excluded
- **WHEN** a persisted run is pending, has conflicting or missing preview boundary metadata, or lacks any required quality metric
- **THEN** it is excluded from `total`, `previewCount`, and `recentRuns`
- **AND** it remains unavailable as official evidence.

#### Scenario: Complete preview runs are included
- **WHEN** a student-owned run is completed, preview-only, officially ineligible, and has all quality metrics
- **THEN** it contributes exactly once to `total` and `previewCount`
- **AND** the newest five eligible runs may appear in `recentRuns`.

#### Scenario: Statistics cover paginated candidates
- **WHEN** eligible records span more than one database page
- **THEN** the server continues the same user-scoped RepeatableRead scan with a stable cursor
- **AND** the count includes eligible records after the first page without changing official result boundaries.
