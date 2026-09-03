## Context

Active knowledge requests are served by `src/app/api/knowledge/_active-authority.ts` and the active shard routes, with runtime-facing projections under `src/lib/authoritative-knowledge`, `src/lib/authority-domain-catalog`, `src/lib/authority-domain-shards`, `src/lib/resource-*` and `src/lib/teaching-projection` readers. The repository also contains ActKG release registries, qualification/cutover scripts, runtime publication helpers and version compatibility adapters. Some of those files are currently reachable from shared `src/lib` imports, so a product read can acquire release-tooling knowledge and a compatibility entry can survive without a current consumer.

The existing release, activation and rollback specs are upstream contracts. C21 provides the missing dependency and deletion proof; it does not replace any of those contracts or activate a new release.

## Goals / Non-Goals

**Goals:**

- Make runtime read dependencies one-way and independent of release writers.
- Define a complete compatibility inventory with production, operator, test and historical consumer classes.
- Retire a compatibility slice only after source-bound zero-consumer, replacement, rollback and negative-path evidence.
- Keep active/hash/rollback identities, role isolation, candidate/production separation and fail-closed behavior intact.

**Non-Goals:**

- No Authority selector, domain shard, ActKG schema, Teaching Projection schema or production Authority change.
- No rewrite of the existing Runtime Release, OSS deployment, bundle admission or activation protocol.
- No deletion based only on a name, old version number, file size or a stale census row.
- No new generic registry, second release manifest, second hash authority or compatibility facade.

## Decisions

### 1. Define an explicit runtime-read seam

Product routes and runtime components may import only the existing read contracts, typed projections, resource index/eligibility readers and safe launcher descriptors. Release/cutover/qualify modules remain reachable from tool entrypoints, not from the product graph. If a shared helper currently mixes read and write concerns, split the smallest pure read surface and leave the writer in the tool graph.

### 2. Treat release tools as independent applications

Content export, knowledge publication, Teaching Projection generation, Runtime Release publication, activation and rollback retain their current commands and owners. The boundary is proved by import-graph checks and independent focused command execution; a tool may consume a read contract, but the application must not import its writer implementation or require an operator receipt to render an already active read.

### 3. Retire compatibility by evidence, not version age

For each v1/v2/v022 registry or adapter, record owner, source revision, actual callers, replacement, rollback need, and deletion condition. A slice with no production or operator caller and a verified replacement may be deleted together with only its duplicate tests. A test-only or historical reader is not a production consumer but remains an explicit audit record until its retention owner releases it.

### 4. Keep identities and roles orthogonal to the boundary

Read isolation does not mean dropping `active`, `candidate`, `legacy`, snapshot, projection, manifest, hash or rollback checks. The read side must still reject drift and foreign roles. Candidate/preview data remains non-production and non-official; release tooling may inspect it but cannot make it active through an import or convenience fallback.

## Risks / Trade-offs

- [Risk] A release helper contains an undocumented pure reader used by a route. → Build a complete static/dynamic caller inventory first; classify and extract that reader before deletion.
- [Risk] Removing a compatibility slice breaks rollback or an operator command. → Require a verified replacement and rollback consumer proof per slice; otherwise retain it as an explicitly owned adapter.
- [Risk] A read path silently starts accepting incomplete artifacts after writer code is removed. → Keep the existing manifest/hash/projection validation at the read boundary and add drift/role negative tests.
- [Trade-off] The tool graph remains available in production repositories. → Availability is intentional; only its import into product runtime is forbidden, and tool publication remains independently invocable.

## Migration Plan

1. Confirm the six G-series blockers and freeze current active read, hash, rollback and role behavior.
2. Inventory imports and dynamic callers between `src/app`/`src/features`/read libraries and release/cutover/compatibility tools; capture each candidate's source revision and deletion condition.
3. Extract or expose only existing typed read contracts, migrate runtime callers, then remove release-writer imports from the product graph.
4. For each compatibility slice, run replacement, rollback and zero-consumer checks; delete only qualified slices and their duplicate tests.
5. Run read-path role tests, tool-only execution tests, import-boundary checks, typecheck, affected domain tests and strict OpenSpec validation.

Rollback restores the last change commit and its read/tool import map. It does not restore a deleted compatibility slice without its recorded rollback proof, and it never moves a production selector or rewrites an active release.

## Open Questions

无。若某 compatibility slice 的消费者、回滚责任或替代入口无法证明，保持 `blocked`/retained，不删除。
