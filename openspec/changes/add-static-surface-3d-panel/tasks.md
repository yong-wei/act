## 1. Capability Registration

- [ ] 1.1 Add `static-surface-3d` to the interactive compute capability registry and registry gate fixtures.
- [ ] 1.2 Add payload validation for static 3D surface modules, including data source, axis labels, color/value meaning, default camera, and fallback evidence.
- [ ] 1.3 Update standard-module tests so unregistered 3D surface capabilities and lesson-private surface kinds fail.

## 2. Shared Surface Viewer

- [ ] 2.1 Implement a shared static 3D surface component using existing Three.js / React Three Fiber / drei dependencies.
- [ ] 2.2 Support precomputed mesh or regular-grid data, color mapping metadata, axis labels, teaching markers, caption text, and bounded responsive dimensions.
- [ ] 2.3 Add camera rotate/zoom controls and a reset-view control without changing the underlying surface data.
- [ ] 2.4 Add image/text fallback for WebGL unavailable, data load failure, or accessibility contexts.

## 3. Manifest Runtime Integration

- [ ] 3.1 Route `compute.panel` modules with `capabilityRef: static-surface-3d` through the shared surface viewer.
- [ ] 3.2 Keep generic `interactive-figure` behavior unchanged for existing lessons.
- [ ] 3.3 Ensure the renderer uses standard commercial module chrome and teaching-semantic visible text.

## 4. Unit 1-2 Integration

- [ ] 4.1 Add or reference the precomputed Unit 1-2 pole magnitude surface data asset.
- [ ] 4.2 Update the Unit 1-2 interactive contract/runtime manifest to use `static-surface-3d` for `pole_magnitude_3d`.
- [ ] 4.3 Preserve `1-2-fig-08-magnitude-surface` and related static media as fallback and review evidence.

## 5. Verification

- [ ] 5.1 Run `openspec validate add-static-surface-3d-panel --strict`.
- [ ] 5.2 Run the interactive module taxonomy and registry gate unit tests.
- [ ] 5.3 Run Unit 1-2 manifest audit and lesson content review gates.
- [ ] 5.4 Run a browser or Playwright smoke check proving the 3D panel is nonblank, rotatable, zoomable, and resettable.
