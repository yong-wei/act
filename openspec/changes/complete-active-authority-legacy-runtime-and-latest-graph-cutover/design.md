## Context

`/knowledge` currently selects between two component trees. Legacy mode mounts `KnowledgeGraphSystem`, which owns the complete Force Graph lifecycle: layout and coordinate persistence, 2D/3D cameras, wheel and pointer gestures, drag and pin, reflow, hover, selection, filters, teaching-path emphasis, and drawer state. Active mode mounts `ActiveAuthorityGraph`; its root level is a static SVG and its domain level mounts the old low-level 2D/3D components through a reduced wrapper inside a bounded scrolling card. That wrapper creates empty layout state, fixed initial positions, inert drag persistence, and no shared camera or orchestration contract.

The data boundary is different and must remain different. Active mode consumes version-matched Authority root/domain shards and formal Teaching/resource projections. Legacy mode consumes the historical graph API. Sharing the presentation runtime must never merge those sources, identities, caches, coordinates, filters, selection, or drawer state.

Production currently demonstrates a second independent gap: deploying a new application image and importing database relations did not move the file-backed graph selectors. The active product still resolves the v0.22 shard set and its domain fragments do not provide a usable Teaching Projection. The existing `coordinate-latest-authority-and-active-oss-cutover` change owns execution-time ActKG capture, complete projection and resource qualification, Runtime publication, selector mutation, stopped-service journaling, and rollback. This change owns the `/knowledge` runtime and its consumer-side proof that the provider's final active combination is actually visible and coherent.

## Goals / Non-Goals

**Goals:**

- Use one established Force Graph runtime orchestration for active root navigation, active domain graphs, and legacy graphs while retaining strict session and data-source isolation.
- Make active mode occupy the shell's complete available workspace and expose the established 2D/3D interaction contract instead of a bounded graph card.
- Preserve all governed active semantics: exact Authority topology, Teaching relations, reversible filters, rich labels and mathematics, resource markers, card stars, cross-domain halos, hover preview, and the node drawer.
- Make `/knowledge` ready only when it consumes one hash-coherent active combination containing the exact Authority, domain shards, complete Teaching Projection and domain fragments, prerequisites, formal resource projection, consumer activation, and Runtime Release.
- Verify the execution-time latest compatible ActKG activation through the public product, including rollback to the predecessor combination.

**Non-Goals:**

- Reading legacy graph data as an active fallback or mapping active and legacy nodes by names or similarity.
- Reimplementing ActKG capture, formal resource binding, Teaching Projection generation, Runtime Release publication, selector mutation, transaction journaling, or rollback.
- Hard-coding v0.37 or any observed predecessor as the permanent latest release.
- Changing ActKG authoring data, inventing Teaching relations, or treating database `KnowledgeLink` rows as the file-backed Teaching Projection.
- Removing the explicit `新版` / `旧版` diagnostic switch; it remains in the unified toolbar with isolated state.

## Decisions

### 1. Extract the old orchestration into a source-neutral shared runtime

The complete layout, gesture, camera, hover, selection, filter, fitting, and presentation-link orchestration now embedded in `KnowledgeGraphSystem` will become a shared runtime surface. Both data modes inject a typed semantic view model and a namespace-scoped session controller. `KnowledgeGraph2D` and `KnowledgeGraphCanvas` remain render backends rather than the definition of migration completion.

Active mode will not wrap those backends with another layout or viewport state machine. Unsupported active presentation primitives will be added backward-compatibly to the shared runtime. The old data loader remains behind the legacy adapter and is not imported by the active adapter.

Alternative considered: keep `ActiveAuthorityForceCanvas` and add missing props one at a time. This would preserve duplicate ownership of layout, camera, toolbar, and session state and would remain vulnerable to drift; it is rejected.

### 2. Represent root entries through the shared runtime without promoting them to knowledge objects

The active root uses the same canvas, gesture, fitting, hover, selection, and responsive sizing infrastructure. Domain and aggregate entries use a dedicated navigation presentation kind in an active-root namespace. They have no semantic relation links, never become Canonical node IDs or edge endpoints, and preserve the line-free root contract.

The current static SVG and deterministic packing may inform initial navigation positions, but they cannot remain a separately interactive canvas authority. A root entry activation changes the active semantic view to the selected domain while keeping the destination session isolated from legacy mode.

### 3. Let the shared shell own all graph controls and available space

`KnowledgeGraphWorkspace` will use a `min-h-0` flex layout whose canvas fills the space below the application shell. Active graph content will not use `overflow-y-auto` around the canvas or a `70vh`/fixed maximum height. Drawer and compact overlays may scroll internally without constraining canvas dimensions.

The unified upper-right control group contains mode, dimension, return-to-root, fit/reflow, search, relation filters, and node-type legend as appropriate to the current level. It uses one collision-aware placement rule so mode controls do not overlap the graph title. Switching modes preserves each namespace's state.

### 4. Preserve active truth in one adapter and one semantic view model

The active adapter emits real registered node types rather than flattening every node to a legacy `THEORY` type. It preserves exact object IDs, predicates, endpoints, direction, layer, rich labels, resource descriptors, Teaching order, cross-domain entrances, and eligibility state. Presentation-only root entries and unavailable-name review artifacts remain outside the product semantic topology.

The shared runtime receives governed presentation metadata without fetching or inferring topology. Force coordinates are presentation state only and cannot create relations or alter the active envelope.

### 5. Introduce a consumer-side coherent active-envelope gate

The `/knowledge` read path will materialize a consumer envelope from the provider's final coordinated active receipt and the currently selected immutable Runtime view. The envelope includes, at minimum:

- captured Authority release, snapshot and manifest hashes;
- domain catalog and every selected shard identity;
- complete Teaching Projection, composed domain-fragment manifest, and relation semantic hash;
- prerequisite publication, formal resource envelope/projection, and consumer activation identities;
- Runtime Release manifest, active receipt, lifecycle generation, and coordinated active receipt.

Every member is reopened and hash-verified. A missing fragment, `PARTIAL` or unavailable projection, mixed Authority, stale resource projection, or absent final active receipt makes the latest-combination readiness false. The base Authority may remain available in an explicitly truthful failure state, but that state is not production-cutover success and cannot be hidden by engineering edges or database rows.

This gate is read-only. It never writes `current.json`, desired/active Runtime state, or transaction receipts.

### 6. Keep provider activation and product acceptance separate but jointly required

`coordinate-latest-authority-and-active-oss-cutover` remains the sole owner of candidate generation and production mutation. It captures the latest complete compatible ActKG release once at execution start; a newer upstream release appearing afterward is input to a later candidate, not a moving target. The complete change is a Buddy `blockedBy` prerequisite for this change, not a late acceptance-only dependency.

The provider completes its separately authorized stopped-service transaction, final active receipt, production readback, and issue achievement before this change can be claimed. This change then implements, builds, and deploys the shared-runtime application revision against the already active coherent successor. Product acceptance is recorded only when the Force Graph runtime, Teaching edges, resource markers, selectors, and readiness all resolve that same successor combination.

Predecessor compatibility and rollback consumption are qualified through the provider's immutable predecessor/rollback evidence and an identity-matched rehearsal, not by delaying provider completion or writing its selectors from this change. If a later provider-authorized rollback occurs, the shared runtime must consume the exact predecessor combination without legacy-data fallback. A successful rollback is not a successful latest cutover, but it preserves service correctness.

### 7. Make browser evidence test behavior, not component presence

Structural tests will reject the active root SVG and active-owned fixed viewport. Interaction tests will drive wheel zoom, pan, drag/pin, reflow, 2D/3D switching, hover, selection, filter disable/re-enable, and mode restoration. Browser QA will measure canvas bounds against the available workspace and verify title/control non-overlap at supported viewports.

Deployment acceptance will read back the exact active IDs and hashes, assert non-empty version-matched Teaching relations in representative domains, and prove that the UI does not display “教学关系暂不可用” for the qualified successor.

## Risks / Trade-offs

- [Extracting orchestration regresses legacy behavior] → Characterize existing legacy interactions before extraction and run the same contract suite against both legacy and active adapters.
- [Root navigation becomes semantic topology] → Use a distinct navigation presentation kind and an empty relation set; forbid root identities from Canonical endpoints and drawers.
- [Large active domains destabilize force layout] → Retain bounded shard loading and presentation budgets, use content-aware collision sizes, and validate the largest admitted domain in both dimensions.
- [A visually working page hides mixed identities] → Derive readiness only from reopened immutable artifacts and the final coordinated active receipt; expose identity mismatch as fail-closed evidence.
- [The latest provider remains incomplete] → Keep this whole change unclaimable through the native Buddy dependency until the provider has completed and revalidated its coherent successor contract.
- [Activation succeeds but the new consumer fails] → Deploy and qualify the consumer first, keep services stopped through provider verification, and use the provider's identity-matched whole-combination rollback.
- [A newer ActKG release appears during execution] → Finish the sealed in-flight capture; do not chase mutable latest state.

## Migration Plan

1. Record the current active and legacy runtime structure, interaction evidence, provider ownership, production predecessor identities, and the exact latest captured successor candidate.
2. Extract and regression-test the source-neutral shared runtime without changing either data source.
3. Move active domain rendering, then root navigation and the unified shell controls, onto the shared runtime; remove the active-specific SVG and bounded canvas authority.
4. Add the coherent active-envelope gate and Teaching/resource consumption tests against qualified immutable fixtures.
5. Verify that the provider change has completed its authorized latest coherent activation, final active receipt, production readback, and GitHub achievement; only then claim this change.
6. Build and deploy the shared-runtime application revision against the already active coherent successor through the established local-build and ECS deployment path.
7. Re-read selectors, immutable artifacts, readiness, `/knowledge`, Teaching edges, resources, and interaction evidence; record product acceptance only when all identities match.
8. Validate predecessor compatibility from immutable provider evidence and an identity-matched rollback rehearsal; any later real rollback remains provider-owned.

## Open Questions

- None. Proposal registration must restore the provider's truthful executable Issue state before creating the native dependency; implementation cannot begin while that dependency is open.
