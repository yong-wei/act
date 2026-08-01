## ADDED Requirements

### Requirement: Structured assistant events are provider-independent
Provider adapters SHALL normalize supported streamed and non-streamed tool-call representations before the Konling runtime persists or renders a turn.

#### Scenario: Supported provider emits a tool call
- **WHEN** a configured provider returns native tool calls, structured blocks, or recognized DSML syntax
- **THEN** the adapter SHALL produce the same internal tool-call contract with parsed arguments and terminal status.

#### Scenario: Provider includes both text and a tool call
- **WHEN** a provider response contains user-visible text and structured call syntax
- **THEN** only the normalized text portion SHALL enter assistant prose
- **AND** the tool call SHALL enter the structured event stream exactly once.
