## 1. Freeze the real denominator

- [x] 1.1 Add a generated baseline that records the exact active catalog's fifteen root domains, current eight available defaults, seven missing defaults, per-domain object/type counts and complete-domain payload sizes.
- [x] 1.2 Add failing tests proving every visible root domain requires default/search/neighborhood/detail closure and that historical `REGISTERED_PEER_DOMAIN_IDS` cannot stand in for the active catalog denominator.
- [x] 1.3 Add failing route/client tests proving desktop currently receives and retains complete heterogeneous domain payloads.

## 2. Rebuild bounded shard contracts

- [x] 2.1 Replace historical domain enumeration with the exact active catalog and generate one default shard for every qualified root domain.
- [x] 2.2 Restrict domain-default objects to qualified `DomainConcept` records and include only valid teaching edges whose endpoints belong to that bounded overview.
- [x] 2.3 Add explicit per-default object-count, byte, response-time and type constraints alongside the existing hash seal.
- [x] 2.4 Prove every secondary object is reachable through bounded search and sealed one-hop/detail closure without returning a full domain.
- [x] 2.5 Regenerate all fifteen domain, family, neighborhood, detail, root, manifest and coverage-receipt artifacts under one immutable shard-set identity.

## 3. Implement shared three-level navigation

- [x] 3.1 Make desktop and mobile enter the same DomainConcept overview and remove the desktop `all model nodes` initialization path.
- [x] 3.2 Make concept selection, search selection, return-to-domain and cross-domain navigation transition between explicit levels without synthetic nodes or edges.
- [x] 3.3 Keep unloaded secondary objects outside browser memory and prevent successive navigation from growing an unbounded cache.
- [x] 3.4 Preserve filters, selection, viewport and inspector state within their valid level and restore the domain overview deterministically.

## 4. Close regression paths

- [x] 4.1 Add negative tests for ghost root entries, non-DomainConcept defaults, complete-domain responses, client-only truncation, name-based grouping and presentation-only relations.
- [x] 4.2 Add route tests for all fifteen root-to-domain paths and representative search/neighborhood/detail paths for every supported secondary type.
- [x] 4.3 Add structural validation that the active root count, catalog count, default-shard count and coverage-receipt denominator are identical.

## 5. Verify the change

- [x] 5.1 Run direct materializer, loader, API and three-level state tests, then the affected knowledge graph domain suite.
- [x] 5.2 Run desktop/mobile browser checks for root, overview, one-hop, search, return and seven formerly missing domains with request-size evidence.
- [x] 5.3 Run typecheck, lint, full `npm run test`, build, commercial UI governance and strict OpenSpec validation on the final clean revision.
- [x] 5.4 Obtain independent review of exact catalog coverage, server-bounded behavior and absence of Authority/Teaching/selector scope expansion.
