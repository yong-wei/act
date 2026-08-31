## Why

Knowledge surfaces now have an authoritative repository, an active workspace, bounded domain shards, role-safe resource bindings, legacy readers, and candidate readers. They each perform useful work, but the public response boundary is spread across route helpers and projection builders. A caller can consequently combine an Authority response with an unrelated Teaching Projection, resource index, cache entry, or learning-content manifest.

The surface needs one server-side, versioned read contract over the existing repository and shard projections. It must bind each response to its Authority snapshot/release and, when teaching or resources are present, to the exact Teaching Projection, scope, and RegistryIndex identities. It must retain independent active/Legacy/admin-candidate modes and preserve the existing #1543 rich-text/math presentation owner.

## What Changes

- Consolidate `AuthoritativeKnowledgeRepository`, active workspace, domain shards, and role-safe resource bindings behind one server-side public read contract; do not create a second read model.
- Define a composite response envelope carrying Authority snapshot/release and, when applicable, exact Teaching Projection, scope, and resource-index identities.
- Isolate active, Legacy, and explicitly authorized admin-candidate reads in resolver, cache, and authorization behavior; clients cannot select a release through URL or cache parameters.
- Omit only mismatched optional Teaching Projection/resource/card/media blocks with safe status while keeping engineering nodes, validation relations, and base detail available.
- Return only source-owned launch descriptors; the knowledge surface does not construct routes or expose internal paths.
- Consume the existing #1543 governed rich-text/math projection. A `authority-learning-content-manifest/v1` versus reader-v2 mismatch fails closed; it is not silently adapted or presented as teaching content.

## Capabilities

### New Capabilities

- `versioned-knowledge-surface-read-contracts`: Defines the server-side response envelope, mode isolation, identity closure, bounded optional failure, launch projection, and version-drift behavior.

### Modified Capabilities

None. Existing `authoritative-knowledge-repository`, `authority-domain-shard-delivery`, `active-authority-semantic-graph-presentation`, `governed-rich-text-math-presentation`, `act-teaching-projection`, and `resource-identity-and-generated-registry-index` remain owners of their underlying records and presentation contracts.

## Impact

- **Owners and denominator:** Characterize all repository/projection/shard readers and callers in `src/lib/authoritative-knowledge/{repository,projections,cache,engineering-authority-consumers}.ts`, `src/lib/authority-domain-shards/**`, `src/app/api/knowledge/_active-authority.ts`, the active/Legacy/candidate knowledge routes under `src/app/api/knowledge/**`, `/knowledge` and `src/features/knowledge/**`. Include Authority/Teaching Projection/resource-index manifests, Prisma/read-model accesses, knowledge-release and resource-governance scripts, route/server-action callers, generated artifacts, compatibility readers, unit/contract/browser tests, and reverse/dynamic callers. The implementation must publish the complete routes/APIs/models/scripts/tests/callers denominator and mode classification.
- **Public target:** A single server-side read entrypoint (for example `readKnowledgeSurface(request)`) returns a versioned `KnowledgeSurfaceResponse` with mode, role, Authority snapshot/release identity, optional Teaching Projection/scope/RegistryIndex identities, bounded blocks, safe status, and source-owned descriptors. Existing routes may adapt this response but may not assemble independent envelopes.
- **Trust boundary:** Server identity closure, authorization, mode separation, manifest version, and cache keys are hard/contract gates. Optional teaching/resource blocks may degrade locally. Read-model or route deletion is a delete gate and belongs to R4; #1543 remains the presentation owner.
- **Dependencies:** Requires `define-resource-identity-and-generated-registry-index` and `enforce-modular-domain-dependency-contracts`. It coordinates with the existing active-authority workspace and its immutable activation readers but does not own activation, deployment, or release publication. It does not depend on the tracking parent as an implementation prerequisite.
- **Non-goals:** No new read model, Prisma schema change, Authority/Teaching Projection activation, selector/cutover/deploy, route redesign unrelated to read identity, mathematical rendering rewrite, or manifest plugin change.
