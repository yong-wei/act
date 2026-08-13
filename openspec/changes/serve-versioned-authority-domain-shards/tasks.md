## 1. Shard Contracts

- [ ] 1.1 Define root, domain-default, relation-family, node-neighborhood and node-detail DTOs with bounded payload contracts.
- [ ] 1.2 Implement the composite Authority, catalog and optional Teaching Projection version envelope.
- [ ] 1.3 Add authorization and routing that keeps full-graph access outside normal product interaction.

## 2. Server and Client Runtime

- [ ] 2.1 Implement root and domain-default projection without fetching or serializing the full graph.
- [ ] 2.2 Implement lazy engineering-family, bounded one-hop and detail/media shard resolvers.
- [ ] 2.3 Add client cache and merge logic that preserves canonical objects, layout, selection and inspector state.
- [ ] 2.4 Implement independent teaching-layer degradation and cache invalidation.

## 3. Verification

- [ ] 3.1 Add request-count, payload-budget, cold-load and version-mismatch tests proving normal users never load the full graph.
- [ ] 3.2 Add partial/empty/unavailable teaching cases proving engineering shards remain usable.
- [ ] 3.3 Run related API/unit tests, performance checks, typecheck and strict OpenSpec validation.
