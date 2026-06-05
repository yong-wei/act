## Why

The report identifies the current model-provider design as too narrow for production, competition, and school deployments. Konling's path-aware coaching, citations, and tool use need a compatibility matrix that can support OpenAI-compatible and Anthropic-compatible providers through one normalized runtime contract instead of provider-specific branches.

## What Changes

- Add a model-provider compatibility capability for service ids, provider kinds, capability matrix, normalized request/response, tool calls, streaming, and citation normalization.
- Add administrator-facing configuration behavior with environment fallback.
- Require provider health, feature support, and safe downgrade behavior for missing tool, reasoning, vision, JSON schema, streaming, or citation support.
- Validate Konling path coaching against at least one OpenAI-compatible and one Anthropic-compatible adapter contract or fixture.

## Capabilities

### New Capabilities

- `model-provider-compatibility`

## Impact

- Reduces deployment risk and future provider debt.
- Supports the cited Konling coaching change but does not change path-planning logic.
- Requires secret handling and admin-scope review during implementation.
