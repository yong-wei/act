## Why

`rtk npx tsc --noEmit --pretty false` currently reports 29 errors in the resource-governance typecheck cluster. These errors concentrate in the resource field-completion audit helper, resource audit tests, textbook/media grounding tests, and one resource baseline helper. The cluster makes the typecheck gate noisy for the same resource-readiness work now being executed.

## What Changes

- Align resource-governance helper output types, literal artifact versions, review audit fields, evidence-contract fields, and null/undefined handling with current contracts.
- Update resource-governance tests and fixtures without weakening review-confirmed semantics.
- Preserve runtime behavior unless a production helper type mismatch reveals a real contract bug.

## Impact

- Targets 29 current TypeScript errors in 4 files.
- Restores the largest current `tsc --noEmit` cluster as a meaningful regression signal.
- Does not change resource semantic data or mark resources complete.
