## Why

The platform needs learner mastery states that can explain evidence at the knowledge-node and capability-target level. Evidence should come from governed path execution, exercises, approved grading, simulation, Arena, interactive lessons, and approved Konling tool outcomes, not from raw model narrative.

## What Changes

- Add evidence writeback semantics from governed learning activities into knowledge/capability mastery state.
- Require provenance, confidence, evidence window, and privacy-safe references.
- Limit Konling-derived evidence to AgentToolRun, approved intervention outcomes, materialized summaries, or verified citation summaries.
- Preserve existing feature-cache and mastery-state boundaries.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `evidence-driven-personalization`: add knowledge/capability evidence writeback requirements.
- `adaptive-mastery-state`: add mastery state traceability at knowledge/capability target granularity.

## Impact

- Affects evidence materializers, learner-state refresh, mastery explanations, path recommendations, and teacher diagnostics.
- Depends on active path completion and resume changes for path execution evidence.
