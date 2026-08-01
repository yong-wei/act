## ADDED Requirements

### Requirement: Adaptive practice exposes answer diagnosis
The adaptive-practice surface SHALL offer a dedicated Konling diagnosis action after a durable answer while preserving existing path-advisor access.

#### Scenario: Student completes an adaptive question
- **WHEN** a durable answer result is available
- **THEN** the page SHALL show `请控灵解析本题`
- **AND** the incorrect-answer action SHALL have primary emphasis while the correct-answer action SHALL use secondary emphasis
- **AND** activating it SHALL open a distinct diagnosis conversation and send the initial diagnosis request automatically.

#### Scenario: Diagnosis creation fails
- **WHEN** the dedicated conversation or initial message cannot be created
- **THEN** the page SHALL show a clear retryable error
- **AND** the student SHALL be able to retry without losing the original path-advisor conversation or entry.

#### Scenario: Diagnosis entry is visually accepted
- **WHEN** the change is prepared for delivery
- **THEN** browser evidence SHALL cover desktop and 320px layouts, correct and incorrect button hierarchy, automatic dedicated conversation opening, retry after failure, and continued path-advisor availability.
