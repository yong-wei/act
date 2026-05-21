## ADDED Requirements

### Requirement: All runtime-first response pages are gated
The system SHALL gate every runtime-first manifest lesson that can produce a student response.

#### Scenario: Bypass is detected
- **WHEN** a response-producing student page does not use the shared manifest submission controller
- **THEN** the gate fails with lesson and step identifiers

### Requirement: Objective response steps require scoreable context
The gate SHALL verify objective quiz steps can produce question summaries or explicit unsupported-scoring metadata.

#### Scenario: Quiz group lacks evidence contract
- **WHEN** a quiz_group step has reference answers but cannot emit questionSummaries or scoring context
- **THEN** the gate fails with the lesson and step identifier
