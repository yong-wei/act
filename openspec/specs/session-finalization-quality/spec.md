# session-finalization-quality Specification

## Purpose

Define governed interactive session finalization and post-class closure quality so supported classroom sessions expose evidence capture, materialization, summary, and cache completion states without fabricating missing evidence.
## Requirements
### Requirement: Interactive finalization uses a shared governance path
The system SHALL provide a shared finalization path for interactive lesson sessions.

#### Scenario: Module 5 finalizers use shared service
- **WHEN** a module 5 teacher ends a supported session
- **THEN** the page calls the shared finalization path rather than duplicating finish and telemetry order

### Requirement: Post-class closure phases are visible
The system SHALL expose whether a session has captured, materialized, summarized, and cached post-class evidence states.

#### Scenario: Cache phase missing is reported
- **WHEN** session facts and reports exist but feature cache refresh is stale or missing
- **THEN** the data-quality report marks the cached phase incomplete

### Requirement: All standard interactive courses use one finalization adapter
The system SHALL finalize every standard interactive classroom course through a single shared finalization adapter.

#### Scenario: Standard course finalizer uses shared adapter
- **WHEN** a teacher ends a supported standard interactive session from 2-1 through 5-6
- **THEN** the course finalizer SHALL call the shared finalization adapter
- **AND** the course file SHALL NOT assemble finalization telemetry or closure phase sequencing by hand.

#### Scenario: Legacy handwritten builder is not wrapped
- **WHEN** the shared finalization adapter is inspected
- **THEN** it SHALL own the finalization payload and closure sequence directly
- **AND** it SHALL NOT preserve `buildSessionFinalizeTelemetry` as a thin wrapper around the old handwritten finalization path.

#### Scenario: Finalization phases remain reportable
- **WHEN** shared finalization completes or partially fails
- **THEN** captured, materialized, summarized, and cached phases SHALL remain visible to data-quality reporting
- **AND** partial failures SHALL be reported without pretending missing evidence was generated.
