## Why

The second-stage Buddy series can be created only from a complete exact owner manifest, not from prototype blocks or provisional snapshot counts. The final preparation child validates all manifests against the indexed source derivation contract.

## What Changes

- Validate manifest completeness, schema versions, source digests, exact counts and IDs, dependency closure, and owner/endpoint coverage.
- Reject placeholders, unresolved ownership, omitted inventory records, duplicate ownership, stale signatures, and undeclared dependencies.
- Require the discriminated future-child schema, algorithm/normalization versions, typed counts/items, namespace-aware deduplication, field applicability, governance/source-snapshot/per-source/upstream digest layers, outputs, acceptance profiles, and scope-anchor evidence.
- Emit the validated second-stage creation input only; do not create the parent or any content-block changes and do not release a production knowledge base.

## Capabilities

### New Capabilities

- `knowledge-rebuild-series-manifest`: defines the complete, closed, placeholder-free contract required before future Buddy child creation.

### Modified Capabilities

- None.

## Impact

- Produces validation evidence and a frozen future-series manifest only.
- Changes no governed content, runtime behavior, authoring source, database projection, or GitHub state.
