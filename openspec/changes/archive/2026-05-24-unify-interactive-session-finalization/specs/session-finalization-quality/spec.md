## ADDED Requirements

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
