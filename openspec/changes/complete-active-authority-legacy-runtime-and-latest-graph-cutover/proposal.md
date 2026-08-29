## Why

The archived Active Authority migration reused the old graph's low-level 2D/3D renderers but left the new root SVG, bounded viewport, toolbar, layout, camera, and interaction orchestration in a separate active-only runtime. Production also still serves the v0.22 shard set without the domain Teaching Projection fragments required by `/knowledge`, so the product continues to show a new-style viewport and “教学关系暂不可用” despite the prior migration and deployment records.

## What Changes

- **BREAKING** Replace the active-only root SVG and minimal Force Graph wrapper with one shared old-graph runtime orchestration for both root navigation and domain graphs; active mode keeps its bounded Authority data adapter but no longer owns a second canvas, layout engine, viewport, or interaction state machine.
- Make the active canvas fill the workspace below the shared shell and preserve the established 2D/3D wheel zoom, pan, drag and pin, force reflow, camera fitting, hover preview, selection, reversible filters, dynamic relations, node decorations, and drawer behavior.
- Consolidate the graph mode, dimension, return-to-root, search, legend, and filter controls into the old runtime shell so the mode switch cannot overlap the title and no active-only scrollable graph card remains.
- Add consumer-side cutover readiness for `/knowledge`: it accepts only one coherent active combination whose immutable revision and hashes bind Authority, domain shards, complete Teaching Projection and domain fragments, prerequisite publication, resource projection, consumer activation, and Runtime Release.
- Require real Teaching relations to be present and enabled by default after the coordinated latest-graph activation; a missing or mismatched fragment remains fail-closed and cannot be reported as a successful production cutover.
- Reuse the capture, candidate generation, selector mutation, stopped-service transaction, and rollback authority already owned by `coordinate-latest-authority-and-active-oss-cutover`; this change does not introduce another graph publisher or production selector writer.
- Treat that provider change as a whole-change prerequisite: this change SHALL NOT be claimed until the provider has a truthful live coordination record and has completed its normative coherent cutover contract, including explicit composed domain-fragment closure.
- Add structural, interaction, browser, deployment-readback, and rollback-consumption tests that distinguish full old-runtime migration from merely mounting a Force Graph element.

## Capabilities

### New Capabilities

- `active-authority-coherent-runtime-readiness`: Defines the `/knowledge` consumer contract for accepting, displaying, and verifying one latest coherent Authority, Teaching Projection, domain-fragment, resource, shard, consumer-activation, and Runtime combination without owning its production selectors.

### Modified Capabilities

- `active-authority-legacy-force-runtime`: Requires root and domain levels to use one complete shared old-graph runtime orchestration and removes the active-specific SVG, bounded canvas shell, and reduced interaction path as conforming implementations.
- `layered-authority-domain-workspace`: Requires the activated latest production workspace to expose its complete matching Teaching Projection by default and prevents an unavailable Teaching state from qualifying as a completed cutover.

## Impact

- Affects `KnowledgeGraphWorkspace`, `ActiveAuthorityGraph`, the root and domain canvas adapters, `KnowledgeGraphSystem`, shared 2D/3D Force Graph orchestration, graph controls, session persistence, rich labels, node decorations, and browser QA.
- Affects the active shard and Teaching Projection read contracts, readiness reporting, deployment verification, and production readback, but does not change ActKG authoring, formal resource binding, Runtime Release publication, or selector mutation ownership.
- Consumes the execution-time latest compatible release and complete coordinated activation produced by `coordinate-latest-authority-and-active-oss-cutover`. If that provider is incomplete or lacks a truthful live coordination record, this change remains unclaimable; if it is mismatched or rolled back after claim, `/knowledge` must remain truthful and production acceptance fails.
- Reuses the existing old-mode data path unchanged; active and legacy data, caches, coordinates, selections, filters, and cameras remain isolated even though their presentation runtime is shared.
