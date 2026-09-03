## ADDED Requirements

### Requirement: Shared calculator runtime tolerates platform line endings and evaluator output variants
The system SHALL normalize platform-specific line endings in the governed calculation script before injection, and SHALL parse real Wolfram Cloud MCP evaluator output shapes, including evaluation-progress prefixes and trailing kernel messages, into the structured result and ordered steps used by math precomputation.

#### Scenario: CRLF checkout still computes
- **WHEN** the governed calculation script is loaded from a Windows/CRLF checkout
- **THEN** the system SHALL still inject the rewritten script and complete the calculation
- **AND** SHALL return a structured result with ordered steps.

#### Scenario: Evaluator returns During-evaluation output
- **WHEN** the Cloud MCP evaluator returns output prefixed with `During evaluation of In[n]:=` or followed by kernel messages
- **THEN** the system SHALL extract the JSON result from that output
- **AND** SHALL NOT discard the whole output as unparseable.

### Requirement: Shared calculator retries transient Cloud MCP connection failures
The system SHALL retry the calculation once when a non-timeout, non-cancelled Cloud MCP connection failure occurs, and SHALL NOT retry on timeout or cancellation.

#### Scenario: tools/call connection drops once
- **WHEN** a `tools/call` request fails due to a transient connection error while the overall budget remains available
- **THEN** the system SHALL reinitialize the session and invoke the evaluator again
- **AND** SHALL return the calculation result when the retry succeeds.

#### Scenario: Timeout does not retry
- **WHEN** evaluation exceeds the configured budget or the request is cancelled
- **THEN** the system SHALL stop and project the governed unavailable/timeout error
- **AND** SHALL NOT invoke the external evaluator again.
