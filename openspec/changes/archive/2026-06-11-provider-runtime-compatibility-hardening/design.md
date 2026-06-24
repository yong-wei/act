## Context

`AIProviderKind` already includes `anthropic-compatible`, and default capabilities describe tools, reasoning, vision, streaming, and citation normalization. The registry currently throws for non-OpenAI-compatible runtime use. This is acceptable as a guard but insufficient for a competition-grade assistant platform.

## Goals / Non-Goals

**Goals:**

- Ensure provider selection never chooses an adapter that cannot run the requested task.
- Normalize OpenAI-compatible and Anthropic-compatible runtime semantics where supported.
- Provide smoke tests and admin health state for assistant-critical modes.
- Preserve secret redaction.

**Non-Goals:**

- Hardcoding provider-specific business logic into grading or Konling.
- Exposing API keys or secret refs to normal users.
- Requiring every provider to support every capability.

## Decisions

### Decision 1: Runtime support is a hard gate

Capabilities are not enough; a provider must have a runtime-supported adapter before selection can return it for live calls.

### Decision 2: Normalized platform objects are the boundary

Provider-specific messages, tool calls, streaming events, structured JSON errors, and citation metadata must be normalized before reaching Konling, grading, report, or prep-pack code.

### Decision 3: Smoke tests cover assistant tasks

Provider smoke tests should include generic chat plus assistant-relevant tasks: structured draft grading, citation-bearing response, streaming, tool-call normalization, and capability-unavailable fallback.

## Validation

- Unit tests cover provider selection, capability gating, unavailable state, and secret redaction.
- Adapter tests cover OpenAI-compatible and Anthropic-compatible fixture normalization.
- Smoke test command runs locally and does not require GitHub Actions.
- `rtk openspec validate provider-runtime-compatibility-hardening --strict` passes.
