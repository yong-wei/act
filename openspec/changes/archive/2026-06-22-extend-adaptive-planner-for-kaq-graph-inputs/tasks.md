## 1. Planner Input Contract

- [x] 1.1 Extend planner input types for LearningGoal id/version, K/A/Q objective boundary, and ExpandedGoalSubgraph.
- [x] 1.2 Add ResourceNode graph profile consumption to planner candidate filtering.
- [x] 1.3 Add ResourceCoverage and Learner/Class overlay input handling with limitations.
- [x] 1.4 Add version refs to generated path artifacts.

## 2. Planning Behavior

- [x] 2.1 Match ResourceNodes against K/A/Q graph targets and prerequisite policy.
- [x] 2.2 Preserve cold-start starter path behavior for graph-driven goals.
- [x] 2.3 Preserve readiness locking for heavy nodes such as simulation and Arena.
- [x] 2.4 Preserve terminal validation distinctions across checkpoint, simulation preview, simulation validation, and Arena official evidence.

## 3. Compatibility

- [x] 3.1 Keep existing `control-correction` path tests passing.
- [x] 3.2 Keep existing `frequency-response-foundations` path behavior compatible.
- [x] 3.3 Preserve path round persistence and append-only execution/deviation/intervention activity.
- [x] 3.4 Preserve Konling path tool audit and idempotency behavior.

## 4. Verification

- [x] 4.1 Add tests for graph-driven LearningGoal path generation.
- [x] 4.2 Add tests for low-resource fallback and overlay limitations.
- [x] 4.3 Add tests proving ResourceSegment/RetrievalChunk/CitationTarget cannot bypass ResourceNode audit.
- [x] 4.4 Run `rtk openspec validate extend-adaptive-planner-for-kaq-graph-inputs --strict`.
