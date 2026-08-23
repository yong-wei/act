## Context

The old knowledge graph already owns the interaction runtime the product needs: `react-force-graph-2d`/`react-force-graph-3d`, a force layout, wheel and touch zoom, pan, drag/pin, dynamic relation rendering, compact legends, hover preview, selection, and a stable inspector. The active-Authority graph instead uses a fixed-height SVG, fixed `viewBox`, static coordinates, and button-driven zoom. The defect is architectural, not a missing CSS rule.

The active view must continue to consume bounded Authority root/domain/family/neighborhood/detail shards and exact teaching/resource projections. It must not consume the old graph APIs or identities. The current checked-in active shard also has unavailable labels for all 408 detail objects, no matched Teaching Projection, and no projected system resources; engine migration cannot fabricate those inputs.

This design follows `docs/grill/20260822-am/adr/20260822-use-the-legacy-force-graph-runtime-for-active-authority.md`.

## Goals / Non-Goals

**Goals:**

- Make the old Force Graph implementation the only product canvas runtime for both old and active data modes.
- Preserve the complete old interaction contract in active 2D and 3D views while keeping active bounded loading and Authority truth.
- Isolate old and active data, caches, layouts, viewports, filters, selections, and drawers.
- Present active-only metadata through node decoration, hover preview, and the existing drawer without creating another resource runtime.
- Provide a development-only static audit artifact for unavailable labels.

**Non-Goals:**

- Reusing unauthenticated old graph APIs as active data sources.
- Generating, reviewing, or publishing teaching relations or resource bindings.
- Adding a runtime review route, role, entitlement, or write API.
- Treating domain navigation projections as Canonical Objects.
- Creating local label translations or accepting an incomplete locale release.

## Decisions

### 1. One Force Graph runtime, two typed data adapters

`KnowledgeGraphSystem` and its Force Graph components become the shared rendering and interaction layer. The old adapter continues to produce the old view model. A new `AuthorityGraphViewModel` adapter converts only bounded active shards and matched formal projections into the same rendering primitives while preserving Canonical endpoints, predicates, direction, layer, and accessibility text.

A separately maintained active SVG product path is removed. If the old engine lacks an active-required presentation primitive, the shared engine is extended compatibly instead of rebuilding that primitive in another renderer.

Alternative rejected: keep the active SVG and copy individual old controls. That preserves two layout, hit-testing, animation, filter, and accessibility implementations and caused the current divergence.

### 2. Data-mode state is namespaced and never cross-mapped

Old and active modes receive independent stores for loaded data, cache keys, force coordinates, viewport/camera, node and relation filters, selected node, hover state, and drawer state. Switching modes restores the destination mode's own session. Names, labels, types, or layout proximity are never used to map state between different identities.

Within active mode, 2D and 3D consume one semantic view model and share filters, selection, and drawer meaning. Each dimension may retain its own camera and spatial coordinates because 2D and 3D force states are not interchangeable.

### 3. Bounded loading remains server-owned

The adapter accepts root navigation, domain-default, relation-family, one-hop, and detail responses. Enabling a missing relation family requests only that active-domain shard. Disabling a family changes visibility but does not discard the loaded shard. Root entries remain line-free navigation projections outside the force-node model.

No ordinary interaction fetches a complete Authority graph, and no active failure falls back to an old API response.

### 4. Old interaction parity is a testable runtime contract

Active mode defaults to 2D and retains 3D. Both support wheel/pinch zoom, pan, drag/pin, force reheat/reflow, dynamic relation effects, compact typed legend, reversible node/relation filters, hover preview, stable selection, drawer focus entry/return, and responsive full-workspace sizing.

Hover preview is deliberately bounded to name, type, short explanation, and availability summary. It does not select the node, load long-form content, or replace keyboard-accessible drawer interaction.

### 5. Node decoration uses one content-aware geometry

The adapter aggregates authorized formal resources into stable visual families while preserving exact runtime subtypes for the drawer. A node may show every applicable family marker simultaneously; a Knowledge Card uses the star marker and does not receive a second generic card icon. A published accessible cross-domain relation produces a persistent animated halo independent of edge visibility filters.

Markers do not create independent hit targets. Node activation opens the drawer. The computed glyph radius has a bounded maximum and is the single source for 2D collision, 3D hit testing, edge endpoints, external-label placement, and camera fit.

### 6. Filters preserve the graph session

Published containment, prerequisite, and pedagogical-association families are enabled by default when present. Engineering families are disabled by default. Every presentable, authorized, already materialized registered node type is enabled by default. Search and one-hop actions may materialize additional nodes without changing these defaults.

All node-type and relation-family controls are true reversible multi-select toggles. Hiding a node type also hides incident edges, but no filter operation resets coordinates, viewport, selection, loaded shards, or drawer state.

### 7. One toolbar owns navigation and mode controls

Domain return, `新版`/`旧版`, and 2D/3D controls share one responsive top-right toolbar. The graph title no longer owns an overlapping absolute-positioned surface. Mobile uses the same ownership with an accessible compact layout.

### 8. Unavailable labels are excluded from product runtime and audited offline

The ordinary active product adapter rejects unavailable-label objects and their incident edges without substituting IDs, locators, raw types, or English fallback. A development script may generate a local static interactive page from frozen Authority candidate and audit inputs. That page reuses the production Authority adapter and shared 2D/3D engine and provides normal/all/unavailable-only modes.

The audit artifact is not a Next.js route, is excluded from application and Runtime Release manifests, needs no login, and contains no signed URL, credential, private original payload, or personal data.

## Risks / Trade-offs

- [The old engine may contain assumptions tied to old DTOs] → Put all source-specific translation behind typed adapters and add tests that reject old DTOs in active mode.
- [Force layout may move when a new bounded shard arrives] → Preserve existing node coordinates and reheat only the affected neighborhood; filter-only changes never restart layout.
- [Multiple markers can make nodes too large] → Aggregate by visual family, cap marker count geometry, and use one tested radius calculation in 2D and 3D.
- [Current active data would produce an empty normal canvas] → Treat the locale qualification receipt as a coordinated final-acceptance dependency; do not weaken label failure closure.
- [Canvas/WebGL evidence differs from the current SVG-specific test] → Replace SVG-tag assumptions with renderer-independent node, edge, endpoint, interaction, and focus evidence.
- [A static audit page has no authentication] → Generate it only from sanitized frozen inputs and explicitly exclude it from routes, deploy output, and Runtime Release manifests.

## Migration Plan

1. Extract/confirm the shared force runtime boundary and introduce source-specific old and active adapters plus mode-namespaced session state.
2. Add active 2D rendering, bounded shard loading, reversible filters, hover preview, drawer integration, toolbar ownership, and node geometry/decorations.
3. Add active 3D parity and test identical semantic behavior across dimensions.
4. Add the sanitized static unavailable-label audit generator and build-exclusion checks.
5. Replace the active product SVG entry with the shared runtime and remove user-reachable fallback paths.
6. Run adapter/unit/browser/security tests against fixed qualified fixtures, then run coordinated acceptance against exact locale, teaching, and resource release identities.

Rollback is a release rollback to the prior revision before activation. The product SHALL NOT retain a permanent user-selectable active SVG fallback.

## Open Questions

None. Exact marker artwork and animation timing may be selected during implementation within the specified semantic and accessibility contract.
