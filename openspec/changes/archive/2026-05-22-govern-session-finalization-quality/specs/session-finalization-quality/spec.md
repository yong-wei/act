## ADDED Requirements

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
