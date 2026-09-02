## ADDED Requirements

### Requirement: Interactive lesson AI failures use student-safe recovery presentation

The embedded interactive lesson AI SHALL normalize transport and service failures before they reach student-visible UI. The interactive surface SHALL expose only an allowlisted student-safe message and, when applicable, a recovery action matched to the failure state.

#### Scenario: Interactive AI receives a generic non-success response
- **WHEN** an authenticated student asks the embedded interactive AI and the request receives a non-success response without a supported recovery state
- **THEN** the hook SHALL classify the failure through the shared student-safe failure contract
- **AND** the panel SHALL not render the raw HTTP status, response body, provider detail or English exception text.

#### Scenario: Interactive AI request fails at the network boundary
- **WHEN** the embedded interactive AI request is rejected by the browser or network
- **THEN** the panel SHALL show a student-safe temporary-unavailability message
- **AND** it SHALL offer the existing retry path without exposing the original exception message.

#### Scenario: Interactive conversation state is invalid
- **WHEN** the service reports an isolated or unavailable interactive conversation
- **THEN** the panel SHALL preserve the specialized session recovery state and action
- **AND** it SHALL not replace that state with a generic raw error.

#### Scenario: Interactive AI succeeds after a failure
- **WHEN** the student completes the matching recovery action and a later request succeeds
- **THEN** the panel SHALL render the assistant response and current conversation history normally
- **AND** no prior raw transport or service error SHALL remain in the student-visible message list.
