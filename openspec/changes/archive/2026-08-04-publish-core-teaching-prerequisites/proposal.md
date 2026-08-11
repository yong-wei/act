## Why

The Teaching Projection can bind resources but still lacks a governed ACT teaching prerequisite graph. Path planning must use a small, explicit core-node denominator and distinguish required teaching dependencies from ActKG engineering relations, textbook order, and course sequence candidates.

## Series Dependencies

- Depends on: `introduce-versioned-act-teaching-projection`, `project-active-course-resources-to-canonical`.

## What Changes

- Add ACT `core-nodes` authoring with explicit `pathEligible`, `cardPolicy`, module, scope, and rationale fields.
- Publish only ACT_TEACHING `PREREQUISITE` edges with `REQUIRED` or `RECOMMENDED` strength.
- Require evidence or teacher-curation rationale, valid Authority endpoints, no self-loops, and an acyclic REQUIRED graph.
- Keep engineering predicates,教材 order, and lesson order as candidates only; they cannot become teaching prerequisites automatically.
- Compute closure/topological order at build time while storing direct edges.

## Capabilities

### New Capabilities

- `act-teaching-prerequisites`: Core-node denominator and ACT-owned prerequisite publication contract.

### Modified Capabilities

None. Learning-path consumption is delivered by the dependent change.

## Impact

- Teaching Projection `core-nodes` and `prerequisites` authoring/runtime artifacts, evidence reports, and prerequisite validation.
- No ActKG engineering relation mutation, database table, deployment, or historical LearningFact rewrite.
