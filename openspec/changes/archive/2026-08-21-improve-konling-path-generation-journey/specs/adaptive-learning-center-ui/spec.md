## ADDED Requirements

### Requirement: Adaptive path generation starts once from the primary action
The adaptive learning center SHALL open Konling and start exactly one governed path-generation request when an eligible student activates the primary generation action.

#### Scenario: Student activates generation once
- **WHEN** an eligible student activates the primary path-generation action
- **THEN** the page SHALL open the Konling sidebar and submit one generation request without requiring a second action

#### Scenario: Student activates generation twice before rerender
- **WHEN** two activation callbacks occur before React commits the first pending state
- **THEN** a synchronous admission guard SHALL allow only one request to be submitted
- **AND** both callbacks SHALL NOT create distinct request identities

### Requirement: Path generation lifecycle remains visible and target-safe
The adaptive learning center SHALL expose pending, running, succeeded, and failed generation states while preserving the selected target during active work.

#### Scenario: Generation is active
- **WHEN** a generation request is pending or running
- **THEN** the learning target control SHALL be disabled
- **AND** the Konling sidebar SHALL show the current request status without creating a model chat request

#### Scenario: Generation succeeds
- **WHEN** the governed generation request succeeds
- **THEN** the page SHALL refresh the generated path in place and show succeeded status in Konling
- **AND** it SHALL NOT immediately replace the page before the status can render

#### Scenario: Definitive generation failure is retried explicitly
- **WHEN** the server reports a definitive failed or blocked result and the student explicitly activates regeneration
- **THEN** the page SHALL create a new generation request identity
