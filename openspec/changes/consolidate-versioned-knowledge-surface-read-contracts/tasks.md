## 1. Preconditions and denominator

- [ ] 1.1 Verify R1, the existing active-authority workspace, `authoritative-knowledge-repository`, `authority-domain-shard-delivery`, and #1543 presentation contracts.
- [ ] 1.2 Inventory all active/Legacy/candidate repository readers, shard builders/loaders, role-safe resource bindings, learning-content/rich-text projections, routes, APIs, models/read accesses, scripts, generated artifacts, caches, tests, and direct/reverse/dynamic callers.
- [ ] 1.3 Freeze response fields, mode/role behavior, cache keys, Authority/Teaching Projection/resource identities, optional failure states, launch descriptors, and v1/v2 manifest observations.

## 2. Public server-side read contract

- [ ] 2.1 Define a request boundary for bounded surface kind, node/domain intent, role/scope, locale, and server-resolved mode; reject client-supplied release/snapshot/projection/index selection.
- [ ] 2.2 Define `KnowledgeSurfaceResponse` with contract version, mode/role, Authority snapshot/release identity, optional Teaching Projection/scope/RegistryIndex identity, bounded blocks, statuses, and source-owned launch descriptors.
- [ ] 2.3 Keep repository and domain-shard owners as the only data sources; do not add a second read model or independent full-graph join.
- [ ] 2.4 Make mode-aware cache keys and server resolution isolate active, Legacy, and authorized admin candidate responses.

## 3. Strict identity and bounded projection

- [ ] 3.1 Require exact Authority closure for every response and exact Teaching Projection, scope, RegistryIndex, capture/revision, and role closure for teaching/resource blocks.
- [ ] 3.2 Omit only mismatched optional teaching/card/media/resource blocks with safe status while preserving engineering nodes, valid verification relations, and base detail.
- [ ] 3.3 Project only source-owned launch descriptors; prohibit route construction, internal paths, object keys, signed URLs, raw bodies, and hidden review/evaluation payloads.
- [ ] 3.4 Accept only `act-authority-learning-content-manifest/v2` for the v2 reader; reject v1, malformed, duplicate, missing, or cross-release content without silent compatibility.
- [ ] 3.5 Delegate all rich-text/math fields to #1543's governed projection and preserve its locale, math-slot, release, and readiness identities.

## 4. Route migration and deletion ledger

- [ ] 4.1 Migrate active root/domain/family/neighborhood/detail/search routes through the common envelope while preserving bounded shard loading.
- [ ] 4.2 Migrate Legacy and admin candidate readers independently with explicit authorization and no response mixing.
- [ ] 4.3 Record every old assembler, cache key, compatibility adapter, and route caller with owner, replacement, denominator, revision identity, and deletion/rollback condition; do not leave a permanent wrapper.
- [ ] 4.4 Hand only proven superseded readers to `retire-superseded-resource-governance-entrypoints`; retain historical/rollback/immutable readers and #1498/#1503/#1509/#1515/#1543 contracts.

## 5. Verification

- [ ] 5.1 Add schema/envelope and exact composite identity tests across all surface kinds and modes.
- [ ] 5.2 Add client/server boundary, unauthorized release-selection, cache isolation, role/scope/revision drift, and no-global-join tests.
- [ ] 5.3 Add optional mismatch/base-preservation, launch descriptor safety, v1/v2 manifest drift, rich-text/math delegation, and bounded-shard tests.
- [ ] 5.4 Reconcile route/API/model/script/test/caller denominators and run the affected knowledge API/feature/browser suites plus `rtk npm run typecheck`.
- [ ] 5.5 Run `rtk openspec validate consolidate-versioned-knowledge-surface-read-contracts --type change --strict` and `git diff --check`.
