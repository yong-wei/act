## Why

`tsc --noEmit` reports 8 errors in SAR persistence and teacher KAQ evidence trace tests. The errors reflect stale persisted-record fixture shapes, corpus family/source enums, learner-state fixture drift, and citation address nullability.

## What Changes

- Align SAR persistence fixtures with current persisted entity/event/relation/query trace contracts.
- Align teacher KAQ evidence trace fixtures with current learner-state and corpus citation contracts.
- Preserve privacy, retention, and official evidence authority boundaries.

## Impact

- Targets 8 current TypeScript errors in 2 data-governance test files.
- Keeps SAR and teacher evidence metadata typed without loosening privacy boundaries.
