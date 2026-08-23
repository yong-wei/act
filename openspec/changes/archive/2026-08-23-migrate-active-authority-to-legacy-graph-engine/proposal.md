## Why

The current active-Authority graph is a separate fixed-viewBox SVG viewport, so it does not provide the full-canvas force layout, wheel zoom, pan, hover preview, dynamic edges, compact legend, reversible filters, or stable inspector behavior already available in the old graph. Maintaining a second renderer has created both interaction regressions and duplicated graph behavior; the active data projection should instead run through the established old-graph engine while preserving strict data and state isolation between `新版` and `旧版`.

## What Changes

- Replace the active-Authority SVG renderer with an adapter into the established old-graph force runtime; retain 2D as the default and the old engine's 3D mode, force layout, wheel/pinch zoom, pan, drag/pin, dynamic relation effects, hover preview, compact legend, and full available-workspace canvas.
- Keep active and old data sources, loaded shards, layout coordinates, viewport, filters, selection, drawer, and caches independent even though they share the same engine implementation.
- Move active-only metadata and actions into the existing node inspector/drawer. Keep all node decorations inside a content-aware glyph: cross-domain relations use a persistent animated halo, governed Knowledge Cards use a star, and every bound formal resource family has its own simultaneous marker.
- Make relation-family and node-type filters fully reversible without resetting layout, viewport, selection, or inspector state. Teaching relations remain on by default; engineering families remain off by default; all presentable node types remain enabled by default.
- Hide objects whose human-readable label is unavailable in the ordinary product view. Provide a development-only static audit artifact, using the same adapter and old engine, with normal/all/unavailable-only modes for review; do not add an application route, runtime role, or deployed review service.
- Put the `新版`/`旧版` switch beside the existing return control in one non-overlapping top-right toolbar and remove the overlapping title treatment.
- Preserve the existing bounded active-Authority APIs and progressive shard loading. The renderer SHALL NOT synthesize relations, merge active and old graph identities, or use root domain navigation entries as knowledge nodes.

## Capabilities

### New Capabilities

- `active-authority-legacy-force-runtime`: Defines the shared old-engine runtime adapter, per-mode state isolation, force/2D/3D interaction parity, active-data decorations, and the development-only unavailable-label audit artifact.

### Modified Capabilities

- `active-authority-semantic-graph-presentation`: Makes the full legacy interaction and hover-preview contract explicit for the active canvas, defines internal multi-resource/cross-domain/card node decorations, and hides unavailable-name objects from the ordinary view.
- `layered-authority-domain-workspace`: Makes node-type and relation-family controls reversible and state-preserving, keeps teaching and engineering defaults distinct, and consolidates version switching with domain return navigation.
- `authority-card-infograph-inspector`: Extends the stable node drawer to present active-only metadata, cross-domain entrances, and source-owned launch actions without duplicating resource renderers.

## Impact

- Affects the `/knowledge` active graph renderer, the established `KnowledgeGraphSystem` force runtime, active-Authority adapters, graph state ownership, node/edge drawing, filter and toolbar controls, hover preview, inspector/drawer integration, and graph QA fixtures.
- Continues to consume bounded active root/domain/family/neighborhood/detail shards. No active/old API identity, server selector, release pointer, or cache namespace is merged.
- Consumes formal teaching-relation and resource-binding projections produced by the related governance changes; it does not define or publish those records.
- The accepted architecture decision is recorded in `docs/grill/20260822-am/adr/20260822-use-the-legacy-force-graph-runtime-for-active-authority.md`.
