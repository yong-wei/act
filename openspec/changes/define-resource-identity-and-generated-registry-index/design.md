## Context

The current resource surface has a real render owner in `src/lib/resource-registry.tsx`, parallel metadata in `resource-registry-metadata.ts`, planning and audit semantics in `resource-node-registry.ts` and its consumers, and published resource/projection artifacts under course-content and knowledge governance. `registryId` is consumed by the DB/BOPPPS path, while a Prisma `TeachingResource.id`, a runtime lesson/media id, a Canonical ID, a ResourceNode ID, and a formal binding ID each belong to another lifecycle. This change supplies a join contract; it does not collapse those lifecycles.

## Goals / Non-Goals

**Goals:**

- Give every indexed resource one deterministic governance identity whose source references remain inspectable.
- Expose a typed descriptor and source-owned launcher contract without copying raw content or constructing routes from graph ids.
- Generate one revision-bound index from declared source adapters and published artifacts, with closed denominators and stable hashes.
- Preserve local optional-resource failure and the existing knowledge, runtime, teaching-projection, and rendering owners.
- Leave an auditable migration/deletion ledger for any duplicated hand-written index that is actually replaced.

**Non-Goals:**

- Replacing any source-owned id, migrating every resource, or rewriting Prisma or runtime schemas.
- Merging the manifest plugin registry, DB `TeachingResource` registry, `ResourceNode` registry, Canonical graph, formal binding ledger, or lesson-engine renderer.
- Deciding path eligibility, formal qualification, Teaching Projection activation, consumer activation, or production release.
- Making a missing optional card, media, simulation, or launcher a global knowledge failure.

## Decisions

### 1. Use one governance identity and preserve foreign identities

`ResourceIdentity` is the only identity used by the generated resource-governance index. It contains an opaque deterministic key derived from the ordered tuple `(sourceKind, sourceRef, sourceVersion, contentHash, scope)` and records the tuple fields in full. `launcherContract` is a separately versioned required field of the indexed descriptor and is included in the index closure/hash, because a target that cannot be consumed under the declared launcher is not a usable descriptor.

The record may carry `registryId`, `teachingResourceId`, `runtimeResourceRef`, `canonicalIds`, `resourceNodeId`, and `formalBindingIds` as typed foreign references. None is used as another field's alias, and none is silently generated when the source does not provide it. A runtime lesson/media identity remains owned by the runtime bundle; a Canonical ID remains owned by Authority; a ResourceNode ID remains owned by planning governance; and a formal binding ID remains owned by the Teaching Projection/binding contract.

### 2. Adapters read source-owned registries and published artifacts

Each `SourceAdapter` declares its `sourceKind`, source version, scope policy, input identity, and output schema. Adapters read the existing render metadata, DB/resource projections, ResourceNode/audit projections, or immutable published artifacts through approved public boundaries. They do not edit source records, parse arbitrary workspace files, or create a private fallback registry. The builder rejects duplicate source identities, ambiguous ownership, missing hashes where a source contract requires them, and an adapter that omits its input capture identity.

The generated `RegistryIndex` contains the generator contract/version, source revision or immutable artifact identities, ordered entries, entry identity hashes, launcher-contract identities, and bounded status/reason fields. Entries are sorted by complete identity and serialized canonically. Regenerating from the same inputs is byte-identical; a changed source, artifact, version, scope, or launcher contract creates a new index identity and never mutates the old one.

### 3. Descriptors reference existing launchers

`ResourceDescriptor` exposes display-safe title/type, the `ResourceIdentity`, source references permitted for that surface, availability, and a source-owned launcher descriptor. The launcher descriptor identifies an existing registry/route/feature launcher class and contract version; it does not contain raw component paths, filesystem paths, signed URLs, hidden evaluation data, or a route assembled from a Canonical ID. The rendering implementation remains in `resource-registry.tsx` and the existing lesson-engine/resource owners.

The server resolves role and scope before returning a descriptor. A consumer passes the descriptor to the existing launcher, which rechecks authorization and the current revision. Index membership alone never grants access, path eligibility, formal binding, or learning evidence.

### 4. Missing optional output is explicit and local

An adapter may classify an optional source as `available`, `degraded`, or `unavailable` with a stable code and safe human-facing status. It must not invent a route, hash, source reference, or placeholder binding. The index builder fails closed for a required structural identity or duplicate/corrupt entry; it retains unaffected entries when an optional resource is absent. Knowledge root/detail and engineering topology may therefore remain available while an optional card, media, or launch descriptor is omitted or marked unavailable.

### 5. One index, no second architecture

The generated index is a governance projection, not a new content store or read model. The manifest plugin registry continues to own `module.kind`/`capabilityRef`; the DB registry continues to own `TeachingResource.registryId`; the ResourceNode registry continues to own planning metadata; and the lower-case lesson-engine renderer continues to own DB/BOPPPS rendering. Any compatibility adapter must name its owner, input/output identities, consumers, and deletion condition and cannot become a permanent facade.

## Denominator and migration evidence

Before implementation, freeze the complete entry and caller denominator across production routes, APIs, models, scripts, tests, generated artifacts, and compatibility paths. For each entry record source owner, all foreign identities, source/version/hash/scope fields, launcher contract, current status, direct callers, reverse callers, and whether the entry is source-owned or a derived projection. Record a separate denominator for hand-written tables, generated outputs, and published artifacts so a generated index cannot appear complete merely because its successful output was scanned.

The first migration may generate the index beside existing consumers and compare descriptors byte-for-byte. Once every classified caller uses the public index contract, delete only the duplicate table or branch proven to be superseded; record that deletion in the ledger. Do not delete render owners, source records, historical artifacts, or activation readers in this change.

## Verification

Run identity collision and foreign-id separation tests, adapter input/duplicate/unknown-source tests, canonical ordering and same-input byte-identical generation tests, source/hash/version/scope/launcher drift tests, safe descriptor projection tests, optional failure isolation tests, and route/caller denominator reconciliation. Then run the affected resource/knowledge contract suites, typecheck, strict OpenSpec validation, and `git diff --check`.

## Risks / Trade-offs

- A generated index can become a disguised second registry. → Require source ownership on every adapter, preserve foreign ids, and reject entries without source closure.
- A launcher descriptor can leak implementation details. → Expose only the existing source-owned launcher contract and recheck role/revision at launch.
- Optional degradation can hide a required formal failure. → Classify required structural fields as hard gates and keep formal binding/release gates separate.
- A stale index may be served after a source change. → Bind the index to source revision, content/version/scope hashes, and launcher-contract identity; reject drift rather than reusing bytes.

## Migration Plan

1. Verify the dependency-contract input and freeze all resource registry, source adapter, artifact, route/API, model, script, test, and caller denominators.
2. Add the typed identity/descriptor/adapter/index contract and deterministic builder as a read-only path.
3. Generate a characterized index from source-owned registries and published artifacts, preserving optional unavailable/degraded entries and comparing existing consumer output.
4. Migrate one bounded consumer at a time, remove only proven duplicate table entries, and publish the deletion ledger and zero-duplicate evidence.
5. Hand the index identity and status matrix to the eligibility and versioned knowledge read-contract changes.

Rollback restores the prior consumers to their source-owned registries while retaining the immutable generated index as diagnostic evidence. It does not alter Prisma rows, runtime releases, selectors, or production state.

## Open Questions

None blocking. The implementation may place the pure index builder under the domain public API selected by the dependency contract, but it must retain the listed identities, source ownership, deterministic output, and bounded optional failure.
