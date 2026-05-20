## ADDED Requirements

### Requirement: Student official evaluation failure is browser-reproduced and repaired
The system SHALL support successful official evaluation from a student-authenticated workbench session for supported Arena challenges.

#### Scenario: Student account can reproduce the submit flow
- **WHEN** an implementer validates this change
- **THEN** they SHALL log in with a student account and submit through the Arena-bound workbench in a browser
- **AND** they SHALL capture enough request, response, console, or server evidence to identify the source of any failure.

#### Scenario: Valid official submission does not show generic failure
- **WHEN** a student submits a valid supported controller artifact from the Arena-bound workbench
- **THEN** the UI SHALL NOT show the generic message `Arena evaluation failed`
- **AND** the official evaluation response SHALL either persist a valid Arena submission or show a specific Chinese validation reason.

#### Scenario: Successful student evaluation appears in official data
- **WHEN** the official evaluation accepts a student submission
- **THEN** the submission SHALL be persisted through the Arena official submission path
- **AND** the result SHALL be eligible for the leaderboard rules defined by the task's metric profile.
