## 1. Version Model

- [x] 1.1 Define version ref payloads for goal, graph, resource, overlay, path, planner, and grounding artifacts.
- [x] 1.2 Define staleness and migration limitation enums.
- [x] 1.3 Add validation helpers for required version refs.

## 2. Artifact Integration

- [x] 2.1 Add version refs to new LearningGoal package artifacts.
- [x] 2.2 Add version refs to resource graph profiles and projection metadata.
- [x] 2.3 Add version refs to overlay payloads where materialized.
- [x] 2.4 Add version refs to graph-driven path artifacts and path rounds.

## 3. Grounding and Citations

- [x] 3.1 Preserve version or freshness metadata through citation chips where available.
- [x] 3.2 Add Konling grounding version refs for graph-aware advice.
- [x] 3.3 Expose missing version refs as limitations.

## 4. Verification

- [x] 4.1 Add tests for required version refs on graph-driven path artifacts.
- [x] 4.2 Add tests for stale artifact limitations.
- [x] 4.3 Add tests proving writeback is blocked or degraded without required version refs.
- [x] 4.4 Run `rtk openspec validate version-kaq-graph-overlay-path-artifacts --strict`.
