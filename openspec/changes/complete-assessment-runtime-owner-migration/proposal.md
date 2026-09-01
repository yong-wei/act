## Why

The repository now has an Assessment public API and durable path-attempt application, but runtime catalog selection, item identity, evidence authority, lifecycle coverage, and generated-question concerns still cross `src/features/adaptive-assessment` and `src/features/assessment`. This leaves the Assessment runtime without one complete owner and makes later adaptive retirement depend on an unreliable directory boundary.

## What Changes

- Make `src/features/assessment` the sole product-runtime owner for assessment item identity, catalog-backed selection, path/companion attempts, scoring inputs, diagnostic context, and assessment evidence authority.
- Classify the 14 current `src/features/adaptive-assessment` production files as runtime, authoring/review, or generation/tooling concerns and move each concern to an Assessment-owned runtime or explicitly toolchain-owned boundary.
- Migrate all production routes, workers, scripts, and dynamic/re-export consumers to the Assessment public API or declared application/port boundary; remove cross-domain deep imports.
- Delete obsolete adaptive-assessment runtime entrypoints only after current-head consumer proof and the corresponding characterization tests pass. Preserve existing tables, immutable snapshots, answer history, publication receipts, and approved generation semantics.
- Keep the archived path-attempt contract, catalog eligibility policy, review authority, idempotency, privacy, and response compatibility unchanged; this is an ownership-completion change, not a schema or algorithm rewrite.

## Capabilities

### New Capabilities

- `assessment-runtime-owner-migration`: Complete the Assessment runtime ownership and consumer migration across catalog, attempt, diagnosis, and evidence paths.

### Modified Capabilities

- None. The already qualified Assessment attempt, catalog, persistence, and generation-review contracts remain the behavioral authority; this change closes their remaining source-tree ownership gap.

## Impact

- Affects `src/features/adaptive-assessment/`, `src/features/assessment/`, assessment and learning-path API routes, worker/tool imports, and their tests.
- Requires an exact current-head consumer denominator, runtime/tooling classification, characterization coverage, zero-production-import proof for retired paths, typecheck, focused Assessment tests, and architecture fitness.
- Does not alter Prisma schema, historical data, production selectors, runtime release contents, deployment, or GitHub coordination.
