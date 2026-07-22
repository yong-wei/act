## Why

The preparation series needs one exact, placeholder-free manifest before stage two can be proposed. ADR 0045 narrows cutover evidence to current truth, active references, legacy compatibility, and the new-fact write boundary.

## What Changes

- Validate exact child records, ownership, endpoints, dependencies, digests, acceptance profiles, and scope anchors without changing the #947–#955 topology.
- Validate cutover inputs for new projections, reviewed legacy mappings, active-reference migration, legacy parsing compatibility, and post-cutover new-fact revision binding.
- Exclude historical fact backfill, event replay/deduplication, learner-state reconciliation, and full-root writer equality from readiness.

## Capabilities

### New Capabilities

- `knowledge-rebuild-series-manifest`: defines exact future-child and bounded cutover-readiness validation.

### Modified Capabilities

- None.

## Impact

- Produces only a validated manifest and reports.
- Does not create stage-two changes, migrate data, or modify production behavior.
