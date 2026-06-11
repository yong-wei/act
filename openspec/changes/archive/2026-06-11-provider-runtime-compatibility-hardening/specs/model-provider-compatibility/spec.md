## ADDED Requirements

### Requirement: Runtime support gates provider selection
Provider selection SHALL require both declared capabilities and a runtime-supported adapter.

#### Scenario: Provider has metadata but no adapter
- **WHEN** a provider declares matching capabilities but its provider kind has no runtime-supported adapter
- **THEN** the registry SHALL return unavailable or select another capable provider
- **AND** live Konling, grading, diagnosis, report, or prep-pack calls SHALL NOT route to that provider.

#### Scenario: No provider satisfies requirements
- **WHEN** no enabled provider can satisfy task capability and runtime support requirements
- **THEN** the caller SHALL receive an explicit unavailable or downgraded state
- **AND** the system SHALL NOT fabricate citations, tool results, or structured outputs.

### Requirement: Provider adapters normalize assistant runtime semantics
Provider adapters SHALL normalize messages, structured outputs, tools, streaming events, errors, and citations into stable platform objects.

#### Scenario: OpenAI-compatible provider is used
- **WHEN** an OpenAI-compatible provider handles an assistant task
- **THEN** messages, tool calls, JSON outputs, streaming chunks, errors, and citation metadata SHALL be normalized before reaching platform business logic.

#### Scenario: Anthropic-compatible provider is used
- **WHEN** an Anthropic-compatible provider is marked runtime-supported
- **THEN** `tool_use`, `tool_result`, streaming events, content blocks, structured outputs, errors, and citations SHALL be normalized into the same platform contract used by other providers.

### Requirement: Provider smoke tests cover assistant tasks
The platform SHALL provide local smoke tests for assistant-critical provider behavior.

#### Scenario: Smoke tests run
- **WHEN** an operator runs local provider smoke validation
- **THEN** it SHALL test chat, structured draft grading, citation-bearing response, streaming behavior, and unavailable-capability fallback
- **AND** failures SHALL report provider id and capability category without exposing secrets.
