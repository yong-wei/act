## Why

Many foundational nodes for feedback, closed-loop structure, transfer-function modeling, and time-domain response still have no resource refs, so planner and Konling cannot reliably ground starter paths.

## What Changes

- Cover feedback-loop-concept-foundations, transfer-function-modeling-foundations, and time-domain-response-analysis target nodes.
- Use helper workqueues, SAR/RAG candidate search, and human review to choose resources.
- Update graph-resource coverage artifacts or source records according to existing ownership rules.

## Impact

- Adds a staged resource-completion batch under `resource-path-readiness`.
- Requires helper before/after evidence and independent review before downstream gates can rely on the result.
- May update resource governance data, helper output, tests, and spec deltas within this change boundary.
