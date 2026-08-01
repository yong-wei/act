## ADDED Requirements

### Requirement: Path generation request identity survives unknown outcomes
The Konling path-generation boundary SHALL preserve one client-visible generation request identity across rerenders, repeated callbacks, active-status checks, and retries whose server outcome is unknown.

#### Scenario: Generation response is lost
- **WHEN** a path-generation request reaches the server but the client receives a connection failure or an unexpected route exception
- **THEN** the client SHALL retain the original generation request identity for its next query or retry
- **AND** the server SHALL derive the same AgentToolRun idempotency key from that identity

#### Scenario: Existing generation is still active
- **WHEN** the same owner repeats a generation request whose AgentToolRun is pending or running
- **THEN** the runtime SHALL return the existing run state
- **AND** it SHALL NOT create a duplicate active path round

#### Scenario: Runtime reports a definitive terminal result
- **WHEN** the runtime reports succeeded, blocked, or failed for a generation request
- **THEN** the response SHALL preserve the request identity and expose the definitive lifecycle state
- **AND** a later explicit regeneration SHALL use a new request identity
