## Why

Current helper output shows hard resource binding blockers: missing runtime lesson JSON for mapped lesson 1-3, 7 TeachingResources without registryId, 36 TeachingResources referencing unregistered registryIds, and 112 TeachingResources without knowledge-node binding.

## What Changes

- Restore or generate the missing runtime lesson 1-3 JSON expected by mapped runtime lessons.
- Resolve missing and unregistered TeachingResource registryId values through existing registry contracts.
- Manually bind each TeachingResource to appropriate knowledge nodes or mark it with an explicit reviewed limitation when no binding is valid.

## Impact

- Adds a staged resource-completion batch under `resource-path-readiness`.
- Requires helper before/after evidence and independent review before downstream gates can rely on the result.
- May update resource governance data, helper output, tests, and spec deltas within this change boundary.
