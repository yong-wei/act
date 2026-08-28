## ADDED Requirements

### Requirement: Provider generation window is strictly inside the task window

The teacher-diagnosis worker SHALL use a task deadline that is strictly later
than the provider generation window. The provider window SHALL cover the
structured request and at most one JSON fallback. The worker SHALL retain
time after the provider window for validation, persistence, and attempt
status. The queue lock duration SHALL cover the complete task window.

#### Scenario: Budget constants are loaded

- **WHEN** diagnosis generation timeout constants are read
- **THEN** the provider generation window SHALL be strictly less than the
  worker task window
- **AND** the BullMQ lock duration SHALL be at least the task window

#### Scenario: Provider finishes near its window

- **WHEN** the structured provider returns or fails near the provider window
- **THEN** the worker SHALL still have remaining time to persist completion
  or a retryable failure
- **AND** it SHALL NOT record `diagnosis-generation-timeout` solely because
  the provider window equals the task window

### Requirement: JSON fallback spends remaining provider budget

When structured output is empty and diagnosis opted into JSON fallback, the
fallback SHALL use the remaining provider generation window. It SHALL NOT
reset to a full independent timeout. If no remaining time exists, the worker
SHALL skip fallback and record `diagnosis-provider-empty-output`.

#### Scenario: Structured request leaves remaining time

- **WHEN** the structured request finishes without output and remaining
  provider time is greater than zero
- **THEN** the system SHALL make at most one JSON fallback using that
  remaining time
- **AND** the fallback SHALL abort when the provider window elapses

#### Scenario: Structured request consumes the provider window

- **WHEN** the structured request ends with no remaining provider time
- **THEN** the system SHALL NOT start a JSON fallback
- **AND** it SHALL record `diagnosis-provider-empty-output` as retryable
