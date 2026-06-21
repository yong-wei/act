## 1. Context Contract

- [x] 1.1 Define a server-owned Konling graph context payload for LearningGoal, ExpandedGoalSubgraph, overlays, ResourceCoverage, path artifact, citations, evidence refs, and version refs.
- [x] 1.2 Add context validation for missing goal, graph, resource, overlay, path, citation, and version classes.
- [x] 1.3 Add student-safe and teacher/admin-safe projections.

## 2. Runtime Integration

- [x] 2.1 Load graph context in supported path, graph-center, diagnosis, and prep coauthor modes.
- [x] 2.2 Preserve existing Konling scoped tool permissions and CitationChip verification.
- [x] 2.3 Add missing-grounding degraded states for personalized graph/path claims.
- [x] 2.4 Ensure Konling graph advice remains advisory unless a governed tool records an approved action or outcome.

## 3. Verification

- [x] 3.1 Add tests for complete graph context assembly.
- [x] 3.2 Add tests for missing grounding and citation downgrade behavior.
- [x] 3.3 Add tests proving client page hints cannot expand graph/resource/evidence scope.
- [x] 3.4 Run `rtk openspec validate wire-konling-kaq-graph-context --strict`.
