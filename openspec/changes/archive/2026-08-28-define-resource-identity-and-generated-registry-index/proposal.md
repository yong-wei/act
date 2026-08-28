## Why

Resource registration currently spans the React render registry, metadata, Prisma `TeachingResource` rows, ResourceNode planning records, runtime lesson/media identities, and formal teaching bindings. The names overlap, but their owners and lifecycle rules do not. A new consumer can therefore mistake a render key, a database id, or a graph binding for a launchable resource and create another readiness or registry table.

The refactor needs one explicit resource-governance identity and a generated index that links, rather than merges, those source-owned records. The index must be reproducible from source-owned registries and published artifacts, while optional resources remain locally unavailable instead of taking down the knowledge surface.

## What Changes

- Define `ResourceIdentity`, `ResourceDescriptor`, `SourceAdapter`, and a versioned `RegistryIndex` contract.
- Make the identity explicit about `sourceKind`, `sourceRef`, content hash, source version, scope, and launcher contract, with deterministic serialization and index hashing.
- Generate the index from source-owned registry entries and published artifacts; do not maintain a second hand-written resource table.
- Keep `registryId`, Prisma `TeachingResource.id`, runtime lesson/media identity, Canonical ID, ResourceNode ID, and formal binding ID as distinct foreign references with distinct owners.
- Keep `src/lib/resource-registry.tsx` as the render owner and keep the manifest plugin registry, DB `TeachingResource` registry, and lesson-engine renderers outside this change.
- Make missing optional entries emit a bounded `unavailable` or `degraded` result so base knowledge nodes and unrelated resources remain readable.

## Capabilities

### New Capabilities

- `resource-identity-and-generated-registry-index`: Defines the source-bound identity, descriptor, adapter, generated index, and optional-resource failure contract.

### Modified Capabilities

None. Existing `canonical-knowledge-resource-binding`, `resource-node-registry`, `act-teaching-projection`, `formal-runtime-atomic-resource-binding`, and runtime release contracts remain authoritative for their own identities and gates.

## Impact

- **Owners and denominator:** Characterize every entry, export, adapter, and caller of `src/lib/resource-registry.tsx`, `resource-registry-metadata.ts`, `resource-node-registry.ts`, `teacher-resource-node-data.ts`, `resource-field-completion-audit.ts`, and `full-resource-path-readiness-gate.ts`. Include the knowledge/resource API routes, teacher resource routes, lesson-engine renderer callers, Prisma `TeachingResource` reads, runtime lesson/media artifacts, database and knowledge-governance scripts, and all direct unit/integration/contract tests. The implementation must publish the complete route/API/model/script/test/caller denominator; no count is inferred from a directory listing.
- **Behavior:** Registry generation is read-only with respect to source records and produces a revision- and hash-bound index. A descriptor is safe for a caller only after the existing role, authorization, revision, and launcher contract checks.
- **Trust boundary:** Identity fields and source/hash/version/scope closure are hard gates; index schema and deterministic generation are contract gates; optional missing resources are soft, explicit degradation. Physical retirement of old governance entrypoints is deferred to `retire-superseded-resource-governance-entrypoints`.
- **Dependencies:** Requires the public-boundary and dependency rules from `enforce-modular-domain-dependency-contracts`. It must not depend on the tracking parent or on a release/cutover authority. It supplies an input to the eligibility and read-contract changes.
- **Non-goals:** No Prisma migration, bulk rebinding, production activation, selector/deploy change, manifest plugin change, lesson-renderer rewrite, or new runtime physics/knowledge read model.
