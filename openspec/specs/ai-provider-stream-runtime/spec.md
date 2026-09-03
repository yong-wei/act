# ai-provider-stream-runtime Specification

## Purpose
TBD - created by archiving change consolidate-ai-provider-and-stream-runtime. Update Purpose after archive.
## Requirements
### Requirement: Provider and stream runtime has one canonical owner

The platform SHALL resolve provider selection, adapter invocation, response normalization, stream normalization, and redacted provider errors through the existing `src/lib/ai` provider owner, with no parallel provider or stream authority.

#### Scenario: A supported AI caller invokes a provider

- **WHEN** an API route, worker, interactive hook, or smart-preparation caller requests an AI response
- **THEN** it SHALL use the canonical provider runtime and receive the existing normalized response or explicit unavailable state
- **AND** it SHALL NOT parse provider-specific response or stream fields itself.

#### Scenario: A duplicate compatibility wrapper has no callers

- **WHEN** import and behavior evidence proves a wrapper is unused after migration
- **THEN** the wrapper MAY be deleted
- **AND** no second provider registry or stream parser SHALL be introduced as replacement.

### Requirement: Provider configuration remains PlatformSetting-backed and capability-gated

The runtime SHALL read provider settings through the existing `PlatformSetting`-backed settings owner and SHALL require the existing capability, health, priority, secret-reference, and runtime-adapter checks before selection.

#### Scenario: An administrator changes provider settings

- **WHEN** provider settings are read or updated
- **THEN** the runtime SHALL use the existing admin/service validation and audit boundary
- **AND** it SHALL expose secret references rather than credential values.

#### Scenario: A provider lacks a required runtime capability

- **WHEN** no enabled adapter satisfies the requested capability or runtime support
- **THEN** the runtime SHALL return the existing unavailable or conservative downgraded state
- **AND** it SHALL not route around the matrix through a caller-specific provider.

### Requirement: Synchronous and streamed results share normalized semantics

The runtime SHALL normalize text, tool calls, tool results, citations, finish state, and provider failures into the existing platform contracts exactly once at the provider boundary.

#### Scenario: A provider emits text and a tool call

- **WHEN** a non-streamed or streamed provider response contains user-visible text and a structured tool call
- **THEN** normalized text SHALL remain separate from the structured event
- **AND** the tool call SHALL enter the internal event contract exactly once.

#### Scenario: A stream is truncated or malformed

- **WHEN** a stream ends without a valid terminal event or contains an unparseable frame
- **THEN** the runtime SHALL return an explicit recoverable failure according to the existing route contract
- **AND** it SHALL not silently mark the turn complete or expose raw provider payloads.

### Requirement: Ingress, timeout and privacy boundaries survive consolidation

Consolidating the runtime SHALL preserve existing request schemas, authorization, timeout and cancellation behavior, provider-error redaction, and bounded audit fields.

#### Scenario: A request exceeds its timeout or is aborted

- **WHEN** the route timeout or caller AbortSignal fires during provider selection or streaming
- **THEN** the runtime SHALL stop or classify the request using the existing timeout/unavailable semantics
- **AND** it SHALL not leave a duplicate stream or unbounded retry running.

#### Scenario: A provider error contains sensitive data

- **WHEN** a provider returns an error containing a key, secret reference, private endpoint detail, prompt, or raw payload
- **THEN** logs and user-visible responses SHALL use the existing redacted error contract
- **AND** sensitive data SHALL not enter normal AI or business projections.

### Requirement: AI output is advisory and not a business fact

The canonical AI runtime SHALL return advisory model output and structured tool intents only; business facts and side effects SHALL remain owned by the relevant domain public API or application use case.

#### Scenario: A model suggests a course or assessment conclusion

- **WHEN** normalized output contains a suggested grade, mastery, learning fact, course revision, publication decision, or production status
- **THEN** the runtime SHALL expose it only as advisory content or a validated tool intent
- **AND** it SHALL not persist or activate that conclusion without the canonical owner.

#### Scenario: No domain owner can validate a requested side effect

- **WHEN** an AI tool intent has no authorized domain owner, scope, or validation contract
- **THEN** the request SHALL fail closed
- **AND** the AI runtime SHALL not become the fallback business authority.

