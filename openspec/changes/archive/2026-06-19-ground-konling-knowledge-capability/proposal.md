## Why

Konling already consumes server-owned context and verified citations, but future answers should reason through knowledge nodes, capability targets, resource projections, learner evidence, and current path/page context. This improves answer precision without letting the assistant become a new source of truth.

## What Changes

- Add knowledge/capability grounding requirements for Konling modes.
- Require answer intent classification for fact explanation, personalized diagnosis, path advice, grading explanation, and media guidance.
- Require citation-verified resource and evidence support for high-confidence claims.
- Keep writeback gated by governed tools, approved workflows, or materialized evidence summaries.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `konling-agent-runtime`: add knowledge-capability grounding and citation requirements for resource-aware answers.

## Impact

- Affects prompt construction, runtime context, citation classes, assistant mode readiness, and generated response guardrails.
- Does not allow generic chat context to mutate learner state.
