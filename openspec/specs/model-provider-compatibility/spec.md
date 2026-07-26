## Purpose

Define the service-id based AI model provider compatibility matrix for normalized runtime selection, provider semantics, and admin-scoped configuration.
## Requirements
### Requirement: Model providers are registered through a compatibility matrix
The system SHALL register AI model providers through a service-id based compatibility matrix.

#### Scenario: Provider config is read
- **WHEN** an authorized admin or service reads model-provider configuration
- **THEN** the response SHALL include service id, provider kind, base URL or endpoint reference, model name, enabled state, priority, health state, and capability flags for tools, reasoning, vision, JSON schema, streaming, and citation normalization
- **AND** it SHALL expose secret references rather than plaintext API keys.

#### Scenario: Provider is selected for a runtime task
- **WHEN** Konling or another AI runtime requests a provider for a task
- **THEN** the registry SHALL select an enabled provider whose declared capabilities satisfy the task requirements
- **AND** it SHALL return an explicit unavailable or downgraded state when no provider can satisfy those requirements.

#### Scenario: Provider storage is unavailable
- **WHEN** provider configuration storage is unavailable or disabled
- **THEN** the system SHALL fall back to documented environment configuration
- **AND** the fallback SHALL still expose capability metadata or a conservative unavailable state.

### Requirement: Provider adapters normalize AI runtime semantics
The system SHALL normalize provider-specific requests, responses, streaming events, tool calls, and citations into stable platform objects.

#### Scenario: OpenAI-compatible provider is used
- **WHEN** a runtime calls an OpenAI-compatible provider
- **THEN** the adapter SHALL normalize input, output, streaming events, tool calls, tool results, and citations into the platform contract
- **AND** provider-specific response shapes SHALL NOT leak into normal Konling, recommendation, or report code.

#### Scenario: Anthropic-compatible provider metadata is registered before a native adapter exists
- **WHEN** an Anthropic-compatible provider is present in the compatibility matrix
- **THEN** the system SHALL normalize Anthropic-compatible response fixtures for `tool_use`, `tool_result`, streaming events, and citations into the platform contract
- **AND** runtime provider selection SHALL NOT choose that provider until a native runtime adapter marks it as supported.

#### Scenario: Citation capability is missing
- **WHEN** a provider cannot produce or preserve citation data required by a runtime mode
- **THEN** the runtime SHALL choose another capable provider, downgrade to a low-confidence response, or return a clear unavailable state
- **AND** it SHALL NOT fabricate citations.

### Requirement: Provider configuration is admin-scoped and redacted
The system SHALL protect model-provider configuration and errors according to admin and service scope.

#### Scenario: Student reads AI response metadata
- **WHEN** a student or teacher sees AI response metadata
- **THEN** the response MAY identify the service id or capability state where appropriate
- **AND** it SHALL NOT expose API keys, secret references that grant access, internal provider errors, or privileged routing diagnostics.

#### Scenario: Admin updates provider config
- **WHEN** an admin updates provider configuration
- **THEN** the system SHALL validate provider kind, endpoint shape, capability flags, secret reference, and health status
- **AND** it SHALL record an audit event for the configuration change.

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

### Requirement: Smart-lesson structured output has one bounded repair pass
Provider output for a smart-lesson stage SHALL pass deterministic normalization and schema validation before the system MAY request one model-based correction.

#### Scenario: Deterministic normalization succeeds
- **WHEN** a provider result can be normalized into the required stage schema without semantic invention
- **THEN** the normalized result SHALL be validated and persisted
- **AND** no model correction call SHALL be made.

#### Scenario: One correction can repair the result
- **WHEN** deterministic normalization leaves schema violations
- **THEN** the system SHALL make at most one correction request containing the original result, validation failures, and the required schema
- **AND** a valid corrected result SHALL replace the failed candidate within the same stage.

#### Scenario: Corrected result remains invalid
- **WHEN** the single correction result still fails validation
- **THEN** the stage SHALL pause in a retryable failure state
- **AND** automated correction SHALL NOT loop.

#### Scenario: Correction attempt is audited
- **WHEN** a correction request is made
- **THEN** the audit SHALL link the original and correction attempts, their model identities, validation outcomes, and token or cost data when available.

