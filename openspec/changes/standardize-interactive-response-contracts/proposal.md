## Why

Module standardization will not fix data governance if each course can still invent interaction and answer names. Current manifests contain many page-level `interactionKind` values and 17 activity-card `responseKind` values, including text and matching aliases that should share one scoring and evidence contract.

## What Changes

- Define canonical interactive response kinds for choice, multi-choice, text, structured text, parameter sets, ordering, matching, table builders, simulation results, and training results.
- Normalize historical response aliases into canonical response kinds.
- Require matching, ordering, and multi-select scoring to use structure-aware partial credit rather than opaque text equality.
- Align response contracts with `manifest-submission-v2` evidence and existing objective scoring requirements.

## Capabilities

### New Capabilities
- `interactive-response-contracts`: Canonical response kinds, alias rules, submission shape, and evidence expectations for manifest activity cards.

### Modified Capabilities
- `manifest-objective-scoring`: Ensure canonical response kinds use shared structural partial-credit scoring.
- `manifest-submission-evidence`: Require submitted evidence to carry canonical response kind and enough response metadata for governance.

## Impact

- Affects activity card normalization in `src/lib/interactive-lesson-manifest.ts`.
- Affects shared activity rendering and submission telemetry.
- Affects objective scoring, data-quality gates, and later lesson migrations.
