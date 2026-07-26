## ADDED Requirements

### Requirement: Smart-lesson structured output has one bounded repair pass
Provider output for a smart-lesson stage SHALL pass deterministic normalization and schema validation before the system MAY request one model-based correction.

#### Scenario: Deterministic normalization succeeds
- **WHEN** a provider result can be normalized into the required stage schema without semantic invention
- **THEN** the normalized result SHALL be validated and persisted
- **AND** no model correction call SHALL be made.

#### Scenario: One correction can repair the result
- **WHEN** deterministic normalization leaves schema violations
- **THEN** the system SHALL make at most one correction request containing the original result, validation failures, and the required schema
- **AND** a valid corrected result SHALL replace the failed candidate within the same stage.

#### Scenario: Corrected result remains invalid
- **WHEN** the single correction result still fails validation
- **THEN** the stage SHALL pause in a retryable failure state
- **AND** automated correction SHALL NOT loop.

#### Scenario: Correction attempt is audited
- **WHEN** a correction request is made
- **THEN** the audit SHALL link the original and correction attempts, their model identities, validation outcomes, and token or cost data when available.
