## ADDED Requirements

### Requirement: Standard course finalization bypasses are gated
The system SHALL provide a guard that detects standard interactive courses bypassing the shared finalization adapter.

#### Scenario: Handwritten finalization is detected
- **WHEN** a standard course file imports `buildSessionFinalizeTelemetry` or directly calls `trackSessionFinalize` as the session closure path
- **THEN** the gate SHALL fail with the course identifier
- **AND** the failure SHALL require migration to the shared finalization adapter.

#### Scenario: Finalization inventory covers all standard lessons
- **WHEN** the finalization gate runs
- **THEN** it SHALL cover the same standard runtime-first lesson inventory used by submission governance
- **AND** it SHALL include the early units after `migrate-early-units-to-manifest-submission` is complete.
