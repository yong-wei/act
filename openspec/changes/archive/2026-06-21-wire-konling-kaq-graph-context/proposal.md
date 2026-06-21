## Why

Konling already has server-owned runtime context, scoped tools, citation chips, and adaptive path tooling. The graph-path plan needs the assistant to stop treating graph, path, resource, overlay, and citation facts as separate fragments. Without a single graph context contract, graph-driven paths can be generated while Konling still explains them from generic chat or partial page hints.

This change wires Konling to the same LearningGoal, ExpandedGoalSubgraph, learner/class overlay, ResourceCoverage, path artifact, and version references consumed by the graph-driven planner. It is a product contract change, not a new assistant engine.

## What Changes

- Add a Konling K/A/Q graph context contract for graph-aware advice and path explanations.
- Extend the existing Konling runtime to load graph context from server-owned sources.
- Require graph-grounded answers to expose citation refs, evidence refs, version refs, confidence, and missing-grounding limitations.
- Ensure Konling graph advice remains read/advisory unless a governed tool explicitly records an approved action or outcome.
- Preserve existing CitationChip and adaptive path tool semantics.

## Capabilities

### New Capabilities

- `konling-kaq-graph-context`: Defines the structured graph context payload and grounding contract used by Konling.

### Modified Capabilities

- `konling-agent-runtime`: Requires supported path, graph, diagnosis, and prep modes to consume server-owned graph context when making graph-aware claims.
- `learning-evidence-rag-corpus`: Existing citation verification remains the source of displayable citation refs; model-authored URLs remain untrusted.

## Impact

- Affected areas: `src/lib/konling-agent-runtime.ts`, future `src/lib/konling/konling-graph-context.ts`, adaptive path tool adapters, graph-center context routes, and Konling tests.
- Depends on first-class LearningGoals (#640), goal subgraph expansion, ResourceNode graph profiles, learner/class overlays, resource coverage overlays, and artifact version refs.
- Does not implement evidence writeback, ranker logic, CP-SAT repair, or a new model provider path.
