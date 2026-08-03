## Why

Learning paths still use a broad mixture of graph relations and resource heuristics. They need to traverse only ACT `REQUIRED` teaching prerequisites, exclude mastered nodes, and choose accessible projected resources while recording the exact Authority/Projection/resource identity for new evidence.

## Series Dependencies

- Depends on: `introduce-versioned-act-teaching-projection`, `project-active-course-resources-to-canonical`, `publish-core-teaching-prerequisites`.

## What Changes

- Traverse the ACT Teaching Projection prerequisite DAG in reverse from a path-eligible goal.
- Exclude nodes already mastered, topologically order remaining REQUIRED dependencies, and select at least one accessible projected resource per path node.
- Treat RECOMMENDED prerequisites as advisory and keep missing optional cards from invalidating a node.
- Require `pathEligible=true` and at least one accessible resource; do not expose all ActKG fine-grained objects.
- Add canonical/Authority/projection/resource IDs to new LearningFact writes and resolve historical facts through crosswalk on read without full backfill.

## Capabilities

### New Capabilities

None. Existing path-planning and canonical fact identity contracts are modified.

### Modified Capabilities

- `adaptive-learning-path-planning`: use ACT REQUIRED prerequisites and Teaching Projection resources as the authoritative path graph.
- `canonical-knowledge-learning-fact-identity`: record versioned Canonical/Projection/resource identity for new facts and preserve historical crosswalk reads.

## Impact

- Path planner inputs, prerequisite traversal, resource candidate selection, path eligibility/readiness, LearningFact writer/reader provenance.
- No full historical backfill, ActKG relation mutation, database schema expansion, or deployment.
