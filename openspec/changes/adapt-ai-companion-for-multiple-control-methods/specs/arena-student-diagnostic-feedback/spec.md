## ADDED Requirements

### Requirement: Advisory companion guidance is distinct from official Arena feedback
The system SHALL keep task-aware companion guidance separate from diagnostic feedback generated for official Arena submissions. Advisory guidance SHALL not claim that a manually recorded practice observation entered ranking or completed an official evaluation.

#### Scenario: Companion identifies a practice risk
- **WHEN** task-aware companion guidance identifies a metric outside its registered practice boundary
- **THEN** it SHALL describe the observation and a learning action as advisory guidance
- **AND** it SHALL not present score, ranking eligibility, or hidden-scenario pass/fail status.
