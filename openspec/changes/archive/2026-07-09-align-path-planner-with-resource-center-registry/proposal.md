## Why

Current path generation can see a narrower resource pool than the resource center. The resource center already consumes registered resources, runtime lesson projections, runtime lessons, textbook sections, and supporting resource projections, but adaptive path generation still relies on a smaller Konling/path helper registry in some entrypoints. That means semantic completion work can be correct and still not affect generated paths.

Recent helper output shows 5291 inventoried resources, 327 path-eligible resources, and only 54 fully complete resources after audit. The planner must first consume the same governed ResourceNode registry that reports these gaps, or later data completion batches cannot be verified through path generation.

## What Changes

- Align adaptive path-generation candidate loading with the resource center ResourceNode builder and runtime projection contract.
- Ensure generated paths and path diagnostics report which registry/projection version supplied candidate resources.
- Add tests proving runtime projections, lesson steps, handouts/media dispositions, textbook sections, and registered resources are visible to path generation when they are audited path-eligible.
- Preserve ResourceNode governance: retrieval chunks and citation-only records remain out of PathNode generation unless a reviewed PlanningUnit exists.

## Impact

- Affects adaptive path generation, resource registry loading, planner diagnostics, and tests.
- Does not complete resource semantics; it makes completed semantics visible to path generation.
- Blocks final resource-completion closure because closure cannot be proven if the planner consumes a stale or partial candidate pool.
