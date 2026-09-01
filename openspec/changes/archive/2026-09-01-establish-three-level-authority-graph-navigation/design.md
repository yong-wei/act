## Context

The active root advertises fifteen catalog domains, while the sealed v0.37 shard set contains domain-default files for only eight. The materializer iterates the historical peer-domain constant and places every catalog member of those eight domains into `domain-default`; the resulting payloads contain 104–1300 heterogeneous objects and no engineering relations. Desktop state then materializes every returned object, while compact state alone uses the existing primary-scope helper. This contradicts server-bounded progressive exploration and makes the seven uncovered root entries dead ends.

## Goals / Non-Goals

**Goals:**

- Make root, domain overview and selected neighborhood three explicit server-owned levels.
- Cover every active catalog domain and fail qualification before a root entry can point to a missing shard.
- Materialize only qualified `DomainConcept` objects in the initial domain overview.
- Keep every secondary object reachable through bounded search and published one-hop neighborhoods.
- Bind payload, count, latency and closure evidence to one shard-set identity.

**Non-Goals:**

- Reclassifying Authority object types or editing ActKG data.
- Inventing domain membership, teaching order, summary nodes or presentation edges.
- Changing production selectors or making Teaching Projection mandatory for engineering concepts.
- Solving force motion, formula display, bilingual projection or filter layout in this change.

## Decisions

### 1. Catalog denominator, not a historical constant, determines domain coverage

Materialization enumerates the exact active reviewed catalog. It produces a default shard and declared follow-on closure for every visible root domain. Root generation consumes the same coverage receipt and omits or fails the entire candidate if any advertised domain lacks its default path.

Alternative rejected: keep fifteen root entries and mark seven unavailable at runtime. That preserves a knowingly incomplete release and prevents full navigation acceptance.

### 2. Domain-default is a concept overview, not a complete domain dump

The default shard contains only presentable `DomainConcept` members plus real published teaching edges whose endpoints are both eligible concept-overview members. Secondary types remain absent until search or one-hop disclosure. Explicit count and byte limits are both enforced; a two-megabyte ceiling alone is insufficient.

Alternative rejected: transmit every object and hide secondary types in React. It violates the server-bounded requirement and retains network, parsing and memory cost.

### 3. Search and neighborhood responses carry the third level

Search returns bounded identity-safe hits without loading a complete domain into browser memory. Selecting a concept or search hit loads its sealed neighborhood, including Formula, KnowledgeStatement, SystemModel and ModelRepresentation nodes only when connected by real published relations. Successive navigation slides or expands the bounded scope without accumulating an unbounded graph.

### 4. Coverage is a sealed candidate gate

A generated receipt records catalog domain count, default-shard count, overview type counts, neighborhood/detail closure, search reachability, per-shard bytes and object counts. Validation fails on missing domains, non-DomainConcept overview objects, unreachable objects, dangling root entries or complete-domain payloads.

## Risks / Trade-offs

- [Some domains contain hundreds of DomainConcept objects] → Apply an explicit deterministic overview count budget and expose the remainder through bounded server search; do not rank it as Authority importance.
- [Teaching edges reference secondary nodes] → Include only teaching edges whose endpoints are in the concept overview; disclose other endpoints at the selected-node level without inventing substitutes.
- [Changing shard contents invalidates hashes] → Regenerate the complete immutable shard set and pointer candidate together, then verify every manifest hash before any later activation.
- [Search closure can become another full graph] → Enforce page and result budgets and prohibit client caches from retaining undisclosed full-domain records.

## Migration Plan

1. Add failing denominator tests for fifteen root domains, seven currently missing defaults, heterogeneous default payloads and browser full-domain retention.
2. Replace historical domain enumeration with the active catalog denominator and implement concept-only default selection.
3. Rebuild all default/family/neighborhood/detail artifacts and the sealed coverage receipt.
4. Update active workspace state so desktop and mobile start from the same overview and use the same third-level materialization.
5. Validate old selectors and production pointers remain unchanged; publish only through the later authorized release workflow.

## Open Questions

None. Overview budgets are derived from fixture and browser acceptance evidence during implementation and become explicit constants before completion.
