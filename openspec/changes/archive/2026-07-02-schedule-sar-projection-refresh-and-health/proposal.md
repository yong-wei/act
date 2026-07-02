## Why

After SAR records become durable, the platform needs a governed way to refresh projections from changing K/A/Q graph, ResourceNode, evidence corpus, LearningFact summaries, simulation/Arena summaries, and path summaries. Without a refresh and health contract, the persisted index can become stale while admin diagnostics and downstream consumers appear healthy.

## What Changes

- Add SAR projection refresh orchestration and health reporting.
- Track last refresh time, source versions, stale source counts, projection failures, retry state, and operation-ledger evidence.
- Keep refresh output privacy-safe and compatible with persisted SAR records.
- Expose degraded states to administrator governance surfaces without requiring a separate vector service.

## Impact

- Extends `structured-associative-retrieval`.
- Extends `admin-data-governance-dashboard`.
- Depends on persisted SAR index records.
- Does not introduce external SAG infrastructure or large vector indexing.
