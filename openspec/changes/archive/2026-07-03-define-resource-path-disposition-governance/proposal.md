## Why

The data-completeness helper now reports thousands of resources and projections whose citation, path, graph, and evidence states are mixed together. The platform needs a stricter governance contract before agents start filling fields manually: every existing resource must have a reviewed path-planning disposition, but not every resource should become an independent PathNode.

Without this contract, long textbook chunks, image descriptions, transcripts, runtime segments, quizzes, simulations, and registered teaching resources may be promoted inconsistently. That would increase path volume while lowering path quality.

## What Changes

- Define a resource path-planning disposition contract for all existing platform resources.
- Require every discovered resource to be classified as `path-plannable`, `supporting-citation`, `embedded-asset`, `evidence-producing`, or `excluded-with-rationale`.
- Require human-reviewed semantic fields before a resource can become path-plannable or mastery-affecting.
- Extend completeness helper expectations so agents can audit which resources still lack a disposition or reviewed semantic fields.
- Preserve the existing rule that retrieval chunks and citation targets can inform planning but cannot become PathNodes without audited ResourceNode or checkpoint authority.

## Impact

- Extends ResourceNode governance and data-completeness gates.
- Provides the contract for follow-up resource completion changes.
- Does not itself complete all resource metadata or change planner selection.
