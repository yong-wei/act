# sync-error-incident-governance Specification

## Purpose
Define how classroom synchronization failures are grouped, recovered, and reported as governance incidents so raw polling noise does not distort class-level data quality metrics.
## Requirements
### Requirement: Sync failures are summarized as incidents
The system SHALL summarize repeated classroom synchronization failures into incident-level telemetry while preserving raw diagnostic detail.

#### Scenario: Repeated failure burst
- **WHEN** the same user repeatedly experiences the same sync failure source, URL, step, and failure kind inside a short window
- **THEN** governance summaries MUST count the burst as one sync incident
- **AND** raw failure details MUST remain available for debugging.

#### Scenario: HTTP failure remains high signal
- **WHEN** a sync request fails with an HTTP error
- **THEN** the incident MUST retain status and status text
- **AND** the report MUST treat sustained HTTP failures as higher severity than non-timeout aborts.

### Requirement: Transient client noise is downgraded
The system SHALL avoid inflating classroom health reports with client-side abort or hidden-tab polling noise.

#### Scenario: Non-timeout abort
- **WHEN** a request is aborted before timeout and later polling recovers
- **THEN** the system SHOULD suppress or downgrade the incident in class-level health summaries
- **AND** it MUST NOT erase the diagnostic fields needed for debugging.

#### Scenario: Recovery after failure
- **WHEN** a polling channel succeeds after one or more prior failures
- **THEN** the system MUST record or derive recovery state
- **AND** reports MUST distinguish recovered transient failures from unresolved incidents.

### Requirement: Reports expose sync health by severity
The system SHALL report sync health using raw counts, incident counts, affected users, dominant source, failure kind, and severity.

#### Scenario: Class report sync summary
- **WHEN** a class session report is generated
- **THEN** it MUST include raw sync-error count, deduplicated incident count, affected user count, dominant failure source, and severity distribution
- **AND** it MUST distinguish broad service-like failure from concentrated user or network failure.
