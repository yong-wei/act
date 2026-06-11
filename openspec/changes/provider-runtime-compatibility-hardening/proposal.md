## Why

The provider configuration layer already recognizes `openai-compatible` and `anthropic-compatible` providers, but runtime selection only supports OpenAI-compatible adapters. The assistant closed loop depends on stable model calls for grading, diagnosis explanation, Konling modes, and prep-pack coauthoring. Provider metadata without runtime support creates a false sense of compatibility.

## What Changes

- Harden OpenAI-compatible runtime behavior for tool, JSON, streaming, error, and citation metadata.
- Add Anthropic-compatible runtime adapter support or mark it unavailable through explicit capability checks until supported.
- Add provider smoke tests for chat, structured JSON, grading draft, citation normalization, and unavailable-capability fallback.
- Expose admin/runtime health states without leaking secrets.

## Capabilities

### Modified Capabilities

- `model-provider-compatibility`
- `konling-agent-runtime`

## Impact

- Affects AI runtime provider selection and admin diagnostics.
- Does not add new model vendors as product features; it normalizes supported provider kinds.
- Can be implemented independently of diagnosis and grading persistence, but assistant demo readiness depends on it.
