## Context

The report recommends a unified provider adapter because OpenAI-compatible and Anthropic-compatible APIs differ in session state, tool loops, streaming, and citation normalization. The platform needs a stable service-id based matrix so runtime code can ask for capabilities instead of branching on one provider name.

## Goals / Non-Goals

**Goals:**

- Define `ModelProviderConfig` or equivalent provider registry contract.
- Support provider kinds `openai-compatible` and `anthropic-compatible`.
- Normalize requests, responses, stream events, tool calls, and citations.
- Expose capability flags for tools, reasoning, vision, JSON schema, streaming, and citation normalization.
- Provide admin-scope configuration with environment fallback and health checks.

**Non-Goals:**

- Building a model marketplace.
- Migrating all AI features at once.
- Storing plaintext API keys.
- Guaranteeing feature parity when a provider lacks required capabilities.

## Decisions

### Decision 1: Service id is the stable application key

Application code should refer to service ids and required capabilities. Provider-specific base URL, model name, and auth details belong in configuration.

### Decision 2: Capability mismatch is explicit

If a provider cannot support citations, tool use, streaming, or JSON schema required by a Konling mode, the runtime must downgrade, choose another provider, or return a clear unavailable state.

### Decision 3: Secrets are references

Provider configuration may store secret references, not plaintext API keys in normal database payloads or client responses.

## Validation

- Adapter tests SHALL cover OpenAI-compatible and Anthropic-compatible fixtures.
- Runtime tests SHALL cover missing capability downgrade or failure.
- Security tests SHALL verify client payloads never expose secret values.
- `rtk openspec validate add-model-provider-compatibility-matrix --strict` SHALL pass.
