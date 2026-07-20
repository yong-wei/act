## Why

The future course-knowledge rebuild cannot yet be represented as an honest Buddy series because exact owners and endpoints are not frozen. Dated audit counts and prototype blocks are evidence only. Stage one must first freeze exact, digest-bound manifests under `docs/proposals/course-knowledge-base-governance-source-derivation-contract.md`.

## What Changes

- Establish a tracking-only parent for eight independently executable manifest-preparation changes.
- Record the acyclic dependency graph from input inventory through final series-manifest validation.
- Require the discriminated future-child fields defined by `docs/proposals/course-knowledge-base-rebuild-series.md`.
- Prevent creation of any second-stage parent or child until the exact owner manifest is complete and validated.

The child changes are:

1. `inventory-course-knowledge-governance-inputs`
2. `build-global-knowledge-identity-candidate-manifest`
3. `derive-controlled-knowledge-domain-candidate-manifest`
4. `partition-course-knowledge-semantic-blocks`
5. `derive-cross-block-identity-conflict-manifest`
6. `derive-cross-block-relation-review-manifest`
7. `derive-atomic-resource-binding-review-manifest`
8. `validate-course-knowledge-series-manifest`

## Capabilities

### New Capabilities

- `course-knowledge-governance-manifest-series`: defines the tracking-only child inventory, dependency graph, scope boundaries, and completion rule for the preparation series.

### Modified Capabilities

- None.

## Impact

- Adds only OpenSpec and Buddy coordination artifacts; it changes no runtime, authoring data, Prisma model, production database, or GitHub state.
- The parent is a `series-parent` record and SHALL NOT be claimed as product implementation.
- The second-stage rebuild series remains intentionally absent until all eight children freeze and validate exact future-child manifests.
