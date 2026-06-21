## Why

LearningGoal packages need a deterministic way to expand into K/A/Q graph nodes before resources or paths are selected. Without a goal-subgraph layer, planner and Konling code would each infer prerequisites differently and lose explainability.

## What Changes

- Add a goal subgraph expansion capability that expands LearningGoal packages into K/A/Q node sets, relation sets, checkpoint suggestions, and limitations.
- Add prerequisite policy semantics for hard prerequisite, soft prerequisite, co-requisite, remediation, extension, transfer, and evidence relations.
- Keep this layer read-only: it explains goal structure but does not generate paths or rank resources.
- Preserve graph body ownership; expansion results reference graph catalog versions without mutating graph nodes.

## Capabilities

### New Capabilities

- `goal-subgraph-expansion`: expands LearningGoal packages into governed K/A/Q subgraphs and prerequisite policy payloads.

### Modified Capabilities

- `kaq-graph-schema`: graph relations must support prerequisite and evidence semantics needed by expansion.

## Impact

- Affects future `src/lib/graphs/graph-expansion-service.ts` and `src/lib/graphs/graph-prerequisite-resolver.ts`.
- Provides input for path planning, Konling grounding, and GraphCenter goal drill-down.
- Does not implement path generation, resource ranking, or evidence writeback.
