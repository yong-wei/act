## ADDED Requirements

### Requirement: Konling presents student-safe failures with state-appropriate recovery
Every active student-facing Konling chat surface SHALL convert transport, HTTP, stream and network failures into a bounded student failure category before rendering. The visible error MUST use Simplified Chinese product copy and MUST NOT include raw response bodies, JSON, browser or SDK exception text, provider details, stack traces, route names or internal machine codes. Recovery actions SHALL match the state transition required by the failure rather than replaying every failed request.

#### Scenario: Chat API returns a structured non-success response
- **WHEN** the AI chat API returns a non-2xx JSON response containing a stable code and public message
- **THEN** the shared client boundary SHALL classify the failure using only allowlisted status and code values
- **AND** the UI SHALL render the bounded student copy rather than the serialized JSON body.

#### Scenario: Browser fetch fails before receiving a response
- **WHEN** DNS, connection or browser transport failure rejects the chat request without an HTTP response
- **THEN** the UI SHALL show a Chinese network-unavailable state
- **AND** it SHALL NOT render `Failed to fetch` or another browser exception string.

#### Scenario: Authentication has expired
- **WHEN** a student message fails because the current session is unauthorized
- **THEN** the UI SHALL explain that authentication must be restored and provide a login or session-recovery action
- **AND** it SHALL NOT offer only a replay of the unchanged unauthorized request.

#### Scenario: Bound conversation no longer exists
- **WHEN** a message fails because the selected owned conversation cannot be found
- **THEN** the UI SHALL refresh or repair the conversation selection and offer a deliberate new-conversation path
- **AND** retry SHALL NOT continue sending the same missing conversation identity.

#### Scenario: Task context or state conflicts with the current request
- **WHEN** a bounded task descriptor is invalid or the current conversation or tool state returns a conflict
- **THEN** the UI SHALL reload the current governed task state or return the student to a valid task entry
- **AND** it SHALL preserve candidate-only, evidence and write-authority boundaries.

#### Scenario: Service or network failure is retryable
- **WHEN** the request is rate limited, the AI service is temporarily unavailable or the network is interrupted while the current task state remains valid
- **THEN** the UI SHALL preserve the student's pending input when feasible and provide a retry-later action
- **AND** the retry SHALL retain the existing idempotency and conversation contracts.

#### Scenario: Failure details are needed for diagnosis
- **WHEN** a Konling request fails and engineering diagnosis is required
- **THEN** the server SHALL record only the existing redacted diagnostic summary and stable failure classification
- **AND** the student-visible response and DOM SHALL remain free of raw technical details.

