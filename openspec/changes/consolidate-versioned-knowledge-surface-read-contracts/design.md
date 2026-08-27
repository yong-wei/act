## Context

The current public knowledge surface is assembled by `AuthoritativeKnowledgeRepository` projections, active-authority helpers, domain shard loaders/builders, and role-safe resource/learning-content projections. `src/app/api/knowledge/_active-authority.ts` already mediates active responses, while legacy and candidate routes have separate readers. The goal is a common read envelope over these owners, not another database table or shadow graph.

The runtime learning-content manifest is currently `act-authority-learning-content-manifest/v2`. Older v1 bytes and a reader that expects v2 are different contracts. Treating the mismatch as compatible would manufacture a teaching projection from an unverified artifact.

## Goals / Non-Goals

**Goals:**

- Provide one server-side public read contract with complete Authority and optional teaching/resource identity closure.
- Keep active, Legacy, and admin candidate modes separate in authorization, resolver, cache, and response semantics.
- Preserve bounded root/domain/neighborhood/detail shards, role-safe resource descriptors, and local optional failure.
- Enforce client/server identity boundaries and exact manifest version compatibility, including the known v1/v2 drift.
- Use the existing #1543 rich-text/math projection without duplicating parsing, rendering, or readiness logic.

**Non-Goals:**

- Building a second read model, copying raw Authority/Teaching Projection data, or merging repositories and shard stores.
- Replacing existing activation/cutover pointers, release writers, Legacy history, crosswalks, rollback evidence, or immutable readers.
- Constructing routes from node/resource ids, exposing filesystem paths or signed URLs, or rewriting mathematical content.
- Making an optional Teaching Projection or resource block a gate for engineering topology and base semantic detail.

## Decisions

### 1. Use one response envelope over existing owners

Define a server-only request/resolution boundary with a bounded surface kind (`root`, `domain`, `family`, `neighborhood`, `detail`, `search`, or an explicitly authorized candidate diagnostic), role and scope, and a server-resolved mode. Its `KnowledgeSurfaceResponse` contains:

- `contractVersion` and surface identity;
- mode (`active`, `legacy`, or `candidate`) and role-safe authorization result;
- the exact Authority snapshot id/hash, release id/release-set, and Authority projection identity;
- when teaching or resource blocks are present, the exact Teaching Projection id/hash, scope identity, RegistryIndex id/hash, and matching capture/revision;
- bounded topology/detail/validation blocks, optional content states, and source-owned launch descriptors.

The envelope is a projection of `AuthoritativeKnowledgeRepository` and domain-shard results. It does not store a new copy or allow a route to join arbitrary blocks. Every existing route adapter must call the server resolver and pass through its envelope identity.

### 2. Resolve mode and release only on the server

Normal clients may request a surface, domain, family, node, locale, and bounded navigation intent. They cannot choose Authority release, snapshot, projection, RegistryIndex, or manifest identity through query parameters, URL fragments, local storage, cache keys, or response rewriting. The server resolves active from the committed active reader, Legacy from the explicit historical reader, and candidate only after its existing admin authorization and explicit diagnostic request.

Cache keys include mode, role/scope, Authority snapshot/release/projection identity, Teaching Projection/scope, RegistryIndex identity, locale, surface, and node/domain key. An active response cannot be satisfied from a Legacy or candidate cache entry even when the payload shape is compatible.

### 3. Require exact composite identity for teaching/resource blocks

Engineering objects and admitted validation relation summaries may be returned with the Authority envelope alone when their existing contract permits it. Any teaching relation, Knowledge Card/infograph, textbook/media binding, or other resource block must match the selected Authority snapshot/release, exact Teaching Projection id/hash and scope, RegistryIndex id/hash, resource/capture revision, and role authorization. The resolver compares these identities before joining rows or assets; it never adapts an older release or substitutes a different scope.

When an optional identity does not match, the resolver omits that block and returns a safe status such as `unavailable` or `identity-mismatch`. The base engineering node, valid verification relation, and other matching detail remain readable. A required formal consumer remains blocked under its own contract; this surface contract does not downgrade that gate.

### 4. Project source-owned launch descriptors only

The response may carry a human-facing title/type, role, availability, and source-owned launcher descriptor resolved by the ResourceIndex/feature owner. It must not expose a component import, internal route implementation, filesystem path, object key, signed URL, raw content, candidate review data, or a URL assembled from a Canonical/ResourceNode id. The client invokes the existing launcher and the launcher rechecks current role, scope, and revision. The knowledge resolver does not absorb lesson, simulation, Arena, or resource business behavior.

### 5. Treat learning-content and rich-text versions as strict contracts

The resolver accepts only the exact `act-authority-learning-content-manifest/v2` contract and its same-release shard/Authority identities. A v1 manifest, missing manifest, malformed entry, duplicate entry, or v2 identity mismatch yields a bounded unavailable/omitted optional block and never produces teaching content by conversion, fallback, or display-text synthesis. The resolver consumes #1543's governed rich-text/math projection with its release, locale, math-slot, and readiness identity; it neither parses raw Markdown/LaTeX nor invents a private presentation contract.

### 6. Preserve bounded shard behavior and no global join

Root, domain, family, neighborhood, search, and detail responses retain their existing bounded loading and field restrictions. The common envelope does not request a full Authority graph or global remaining shard. Rich text and math fields remain surface-specific and detail-only where the existing shard contract says so. A response cannot join blocks from separate requests unless their composite identities match exactly.

### 7. Denominator, migration, and deletion are evidence-gated

Freeze all server readers and writers, routes/APIs, Prisma/read-model accesses, scripts, generated manifests, caches, browser/server callers, compatibility adapters, and tests for active, Legacy, candidate, teaching, resource, and rich-content responses. Record direct/reverse/dynamic caller counts, response identities, role/mode behavior, and deletion conditions. Migrate route adapters to the common envelope and remove an old assembler only after zero callers and rollback evidence; R4 owns physical retirement and must not delete retained historical or immutable readers.

## Migration and deletion evidence

First add the envelope around existing readers with characterization fixtures for active, Legacy, candidate, engineering-only, teaching-matching, optional-mismatch, and v1/v2-drift cases. Then migrate one route family at a time and prove no second join or cache authority remains. Any compatibility adapter is temporary, revision-bound, and recorded in the ledger; a re-export or wrapper with old behavior is not completion.

## Verification

Run envelope/schema tests, mode/authorization isolation tests, server-only release-selection tests, composite identity/cache tests, optional mismatch and base-detail preservation tests, launch descriptor safety tests, v1/v2 manifest drift tests, #1543 rich-text/math delegation tests, bounded-shard tests, and complete caller-denominator reconciliation. Then run affected knowledge API/feature/browser suites, typecheck, strict OpenSpec validation, and `git diff --check`.

## Risks / Trade-offs

- A common envelope could hide a second read model. → Keep repository/shard owners as sources and make the envelope request-scoped and derived only.
- Cache or URL inputs could select an unauthorized release. → Resolve all release identities server-side and include them in mode-aware cache keys.
- Optional omission could be mistaken for complete teaching coverage. → Return explicit bounded status and keep formal consumers on their own hard gates.
- v1/v2 compatibility may appear convenient. → Reject v1 for a v2 reader and require a separately qualified versioned adapter.
- Launch descriptors could become feature-specific routing. → Require source ownership and deny internal paths/guessed URLs.

## Migration Plan

1. Verify R1 identity and the active-authority workspace/immutable reader contracts; freeze all response and caller denominators.
2. Define the server-only request, composite envelope, mode, cache, optional-status, and source-owned launcher contracts.
3. Implement the envelope over existing repository and shard readers, with strict Authority/Teaching Projection/RegistryIndex/manifest closure.
4. Migrate active, Legacy, and admin candidate routes separately; retain bounded shards and optional local degradation.
5. Migrate #1543 rich-text/math fields through its existing projection and prove no raw parser or compatibility synthesis is introduced.
6. Publish the route/API/model/script/test/caller ledger and hand superseded assemblers to R4; do not activate, deploy, or delete retained readers here.

Rollback removes migrated route adapters and restores the prior readers while retaining immutable response characterization. It does not alter Authority, Teaching Projection, runtime release, cache artifacts, or selectors.

## Open Questions

None blocking. Exact route adapter names may follow the existing API layout, but all public responses must use the composite identity envelope and strict manifest/version behavior.
