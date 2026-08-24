## 1. Shared Runtime and Adapter Boundary

- [x] 1.1 Characterize the old `KnowledgeGraphSystem` 2D/3D interaction, state, node geometry, legend, hover, and inspector contracts with focused regression fixtures.
- [x] 1.2 Extract the source-neutral Force Graph runtime boundary without changing old-mode behavior.
- [x] 1.3 Implement a typed `AuthorityGraphViewModel` adapter for bounded active root, domain, family, neighborhood, and detail shards that rejects old DTOs and mismatched projection identities.
- [x] 1.4 Keep root domain entries as line-free navigation projections outside the Canonical force-node model.

## 2. Isolated Graph Sessions

- [x] 2.1 Namespace loaded data, request caches, filters, selection, hover, drawer, and layout/viewport state by old and active data mode.
- [x] 2.2 Restore each mode's own state after version switching and add regression tests proving no label- or type-based cross-mapping.
- [x] 2.3 Share active semantic filters, selection, and drawer state across 2D/3D while preserving dimension-specific cameras and spatial coordinates.

## 3. Active Force Graph Experience

- [x] 3.1 Route the active product domain view through the shared full-workspace 2D Force Graph with wheel/pinch zoom, pan, drag/pin, force reflow, dynamic edges, camera fit, and stable selection.
- [x] 3.2 Add active 3D parity using the same Authority view model, filter semantics, selection, and drawer behavior.
- [x] 3.3 Implement bounded, non-destructive pointer and keyboard hover preview using safe already-loaded fields.
- [x] 3.4 Preserve server-bounded progressive loading so enabling a missing family fetches only its domain shard and disabling a family retains the loaded shard.
- [x] 3.5 Remove every user-reachable fixed-viewBox/static-coordinate active canvas path after parity tests pass.

## 4. Filters, Decorations, and Geometry

- [x] 4.1 Replace append-only relation controls with a compact reversible legend that defaults published teaching families on and engineering families off without resetting graph session state.
- [x] 4.2 Add reversible node-type controls with every qualified materialized registered type enabled by default and incident-edge visibility kept consistent.
- [x] 4.3 Aggregate eligible formal resource bindings into simultaneous internal visual-family markers, using the star as the sole Knowledge Card marker.
- [x] 4.4 Add a persistent accessible cross-domain halo and drawer entrance whose eligibility remains independent of edge-family visibility.
- [x] 4.5 Use one bounded content-aware glyph radius for marker layout, 2D collision, 3D hit testing, edge endpoints, external labels, and camera fitting.

## 5. Inspector and Workspace Layout

- [x] 5.1 Extend the stable active node drawer with sanitized active metadata, verified cross-domain entrances, and eligible formal resource summaries while preserving focus entry and return.
- [x] 5.2 Delegate media, text, exercise, simulation, project, and other resource launches to source-owned runtimes with the governed atomic anchor; omit items that cannot be launched safely at that anchor.
- [x] 5.3 Consolidate domain return, `新版`/`旧版`, and 2D/3D controls into one responsive top-right toolbar and remove title/control overlap.
- [x] 5.4 Verify no runtime inspector or route exposes candidate, confidence, review-pack, failed-resource, or unavailable-name review operations.

## 6. Development-only Label Audit

- [x] 6.1 Implement a sanitized static generator that reuses the production Authority adapter and shared 2D/3D runtime with normal-only, all, and unavailable-only modes.
- [x] 6.2 Exclude unavailable-name objects and their incident edges from the ordinary active product adapter without any identity or language fallback.
- [x] 6.3 Add build and release assertions proving the audit artifact is absent from Next.js routes, public/deploy output, and Runtime Release manifests and contains no credential, signed URL, private payload, or personal data.

## 7. Verification and Coordinated Acceptance

- [x] 7.1 Add adapter, state-isolation, filter reversibility, decoration, geometry, and bounded-loading unit tests for both graph dimensions.
- [x] 7.2 Add browser coverage for desktop/mobile full canvas, wheel zoom, pan, drag/pin, dynamic edges, hover preview, 2D/3D switching, drawer focus return, and non-overlapping toolbar controls.
- [x] 7.3 Replace SVG-specific active visual evidence with renderer-independent node, edge, endpoint, focus, interaction, forbidden-surface, and source-revision evidence while retaining the safe allowlist shape.
- [x] 7.4 Run the targeted graph tests, affected Playwright coverage, `rtk npm run typecheck`, and `rtk openspec validate migrate-active-authority-to-legacy-graph-engine --type change --strict`.
- [x] 7.5 Complete coordinated product acceptance only against one exact Authority envelope with a qualified Chinese locale receipt, an accepted matching Teaching Projection, and an accepted matching formal-resource projection; do not accept the current unavailable-label, zero-teaching, zero-resource product state.
